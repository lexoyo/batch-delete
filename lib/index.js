#!/usr/bin/env node
'use strict';

// node modules
const Unifile = require('unifile');
const WebDavConnector = require('unifile-webdav');
const express = require('express')
const launcher = require('browser-launcher3');

const Path = require('path');
const fs = require('fs');

// config
const port = process.env.PORT || '6805';
const rootUrl = `http://localhost:${port}`;
const [node, script, connectorNameCaseSensitive, rootPathArg='/'] = process.argv;

const connectorName = connectorNameCaseSensitive.toLowerCase();
const rootPath = connectorName === 'fs' ? Path.resolve(rootPathArg) : rootPathArg;

const SETTINGS = {
  fs: {
    recursive: true,
    recursiveStartingAtLevel: 0,
  },
  ftp: {
    recursive: true,
    recursiveStartingAtLevel: 0,
  },
  sftp: {
    recursive: true,
    recursiveStartingAtLevel: 0,
  },
  webdav: {
    recursive: false,
  },
  github: {
    recursive: false,
    recursiveStartingAtLevel: 3,
  },
  dropbox: {
    recursive: false,
  },
}

// cli toolkit
const cli = require('cli');
cli.disable('help');
const options = cli.parse();
const test = !!options['test'] || !!options['t'];

if(test) console.info('\nTEST MODE\n')

// init unifile
const unifile = new Unifile();
const session = {};
const connector = (() => {
  switch(connectorName) {
    case 'fs':
      return new Unifile.FsConnector({
        showHiddenFile: true,
        sandbox: '/', //Os.homedir(),
        infos: {
          displayName: 'File System',
        },
      });
    case 'ftp':
      return new Unifile.FtpConnector({
        redirectUri: rootUrl + '/ftp/signin',
      });
    case 'sftp':
      return new Unifile.SftpConnector({
        redirectUri: rootUrl + '/sftp/signin',
      });
    case 'github':
      return new Unifile.GitHubConnector({
        clientId: process.env.GITHUB_APP_ID || '9470507937d6b04a70bd',
        clientSecret: process.env.GITHUB_APP_SECRET || '106624aedeab491b5f31b361a5d63246250fa8c1',
        state: 'aaathub',
        redirectUri: process.env.GITHUB_APP_REDIRECT || rootUrl + '/github/oauth_callback',
      });
    case 'dropbox':
      return new Unifile.DropboxConnector({
        clientId: process.env.DROPBOX_APP_ID || '8lxz0i3aeztt0im',
        clientSecret: process.env.DROBOX_APP_SECRET || 'twhvu6ztqnefkh6',
        state: 'aaathub',
        redirectUri: process.env.DROPBOX_APP_REDIRECT || rootUrl + '/dropbox/oauth_callback',
      });
    case 'webdav':
      return new WebDavConnector({
        redirectUri: rootUrl + '/webdav/signin',
      });
    default:
      console.error('Connector not found:' + connectorName);
      process.exit(1);
  }
})();
unifile.use(connector);

// authentication
const savedSession = fs.existsSync('.cloud-analyser') ? JSON.parse(fs.readFileSync('.cloud-analyser')) : null;
if(savedSession && savedSession[connectorName]) {
	// console.log('> Got session from file .cloud-analyser');
	Object.assign(session, savedSession);
	ls(rootPath)
	.then(root => {
		const actions = getTree(root);
    if(test) return;
    return unifile.batch(session, connectorName, actions);
  })
  .then(() => {
    console.log('Done.')
  })

}
else {
	unifile.getAuthorizeURL(session, connectorName)
	.catch((err) => {
		throw('Error while authorizing Unifile: ' + err);
	})
	.then(result => {
		if(!result) return Promise.resolve();
		return new Promise((resolve, reject) => {
			launcher((err, launch) => {
				if ( err ) {
					console.error('Can not open browser for auth', err);
					reject(err);
				}
				launch(result, process.env.BROWSER || 'firefox', (err, instance) => {
					if(err) {
						console.error('Can not open auth URL', err);
						reject(err);
					}
					instance.on( 'stop', function( code ) {
					});
					waitForToken()
					.then(() => {
						instance.stop();
						resolve();
					})
					.catch(e => {
						instance.stop();
						reject(e);
					});
				});
			});
		})
	})
	.catch((err) => {
		console.error('Error while authorizing Unifile:', err);
		process.exit(1);
	})
	.then((res) => {
		// console.log('> Saving session to .cloud-analyser');
		fs.writeFileSync('.cloud-analyser', JSON.stringify(session));
		return ls(rootPath);
	})
	.then(root => {
		const actions = getTree(root);
    if(test) return;
    return unifile.batch(session, connectorName, actions, 'Delete with batch-delete utility');
	})
  .then(() => {
    console.log('Done.')
  })
}

function ls(path) {
  return unifile.readdir(session, connectorName, path)
	.then(files => {
		const info = files.reduce(
		  (prev, file) => {
				return {
					items: prev.items + 1,
					size: isNaN(file.size) ? prev.size : prev.size + file.size
				}
			},
			{items: 0, size: 0}
	  );
		const promises = files
		.filter(file => file.isDir)
    .map(dir => ls(path + '/' + dir.name));
		return Promise.all(promises).then(children => {
			const childrenInfo = children.reduce(
				(sum, child) => {
					return {
						size: sum.size + child.size,
						items: sum.items + child.items
					}
				},
				{size: 0, items: 0}
			);
			return {
  			path: path,
  			items: info.items + childrenInfo.items,
  			size: info.size + childrenInfo.size,
  			folders: children,
        files: files.filter(f => !f.isDir)
  		};
		});
  });
}

// async function doDelete(path, isDir) {
//   console.warn(isDir ? 'd' : 'f', '\t', path);
//   if(test) return;
//   if(isDir) return unifile.rmdir(session, connectorName, path)
//   else return unifile.unlink(session, connectorName, path)
// }
function toAction(path, isDir) {
  console.warn(isDir ? 'd' : 'f', '\t', path);
  return isDir ? {
    name: 'rmdir',
    path,
  } : {
    name: 'unlink',
    path,
  };
}
function getTree(root) {
  let tree = [];
  if(SETTINGS[connectorName].recursive &&
    root.path.split('/')
      .filter(file => !!file)
      .length >= SETTINGS[connectorName].recursiveStartingAtLevel) {
    tree = tree.concat(
      ...root.folders
      .map(child => getTree(child))
    );
    tree = tree.concat(
      root.files
      .map(file => toAction(root.path + '/' + file.name, false))
    );
  }
  return tree.concat(toAction(root.path, root.isDir !== false));
}


function waitForToken() {
	let server = null;
  return new Promise((resolve, reject) => {
	  const app = express()
    server = app.listen(port, () => {
			// register callback url
			app.get('/:connector/oauth_callback', (req, res) => {
				if('error' in req.query) {
					res.status(500).send(req.query);
					reject(req.query);
				} else {
					unifile.login(session, req.params.connector, req.query)
					.then((result) => {
						if(result) {
							res.cookie('unifile_' + req.params.connector, result);
							res.end('<script>window.close();</script>');
							resolve();
						}
						else {
						  reject('auth failed');
						}
					})
					.catch((err) => {
						console.error('ERROR', err);
						res.status(500).send(err);
						reject(err);
					});
				}
			});
			app.get('/:connector/signin', (req, res) => {
				res.sendFile(Path.join(__dirname, '..', 'oauth_callbacks', req.params.connector + '_login.html'));
			});
    })
	}).then(() => {
		server.close();
	}).catch(e => {
		console.error('stop server, login failed');
		server.close();
		return Promise.reject(e);
	});
}

