Command line utility to batch delete folders from Github, Dropbox or your file system.

Supports **Dropbox, Github, FTP, SFTP, Webdav, NextCloud, OwnCloud** with oauth when available.

This is an efficient way to be clear data which is good for your online storage as well as for mother earth.

See also [this tool to explore your cloud storage and detect which files and folders to start with](https://github.com/lexoyo/cloud-disk-usage)

Road map

* [x] recursively delete a folder from all supported services
* [x] oauth to connect to github and dropbox
* [x] remember connection token from oauth
* [ ] use batch instead of delete each file with a commit etc
* [ ] option to confirm deletion

## Synopsis

`bd SERVICE FILE [OPTION]...`

Possible values of the `service` option (case **insensitive**):

| description | Service |
| ------- | ------- |
| Dropbox | Dropbox |
| local file system | fs |
| FTP | FTP |
| SFTP | SFTP |
| Github | Github |
| NextCloud/Owncloud (with webdav) | webdav |

Available options:

* `-t` test mode => will prompt which file/folder would be deleted

## Examples

Install the npm package

```
$ npm install -g batch-delete
```

Delete the local `Documents` folder

```
$ bd fs ~/Videos
Done.
```

Delete remote folders:

```
$ bd dropbox Photos
Done.
$ bd ftp www
Done.
$ bd github repo1/master/
Done.
```

## Development

### Install

```
$ npm i
```

### test

Delete the `test` folder in the current directory

```
$ node ./lib/ fs ~/Documents
```
