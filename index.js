
/*
Steps
1. Check local version
    a. Local version can be stored in a metadata file
    b. If file does not exists, check for local server files
        I. If no local files, do clean install
        II. If files exist, do update
    c. If file exists, read version
2. Check remote version
    a. Scrape Minecraft dedicated server site for download element
    b. If element is found, check the version and grab link
    c. If not found, return an error
3. Download update to temporary location
4. Unzip update into temp location
5. Purge 'ignored files' from the update
6. Make a backup of the current version in temp location
7. Empty the install location
8. Install update
9. Copy over world and addons from backup
10. Execute launch test
    a. If error empty install location & restore from backup
    b. If no errors, return successful 

*/

import https from 'https';
import path from 'path';
import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import Logger from 'simple-logger';


/**
 * @typedef Config - Configuration for Bedrock Dedicate Sever Updater.
 * @param {String} installLocation - The directory containing the Bedrock Server.
 * @param {String} tempLocation - The directory to store temporary files in.
 * @param {String} updateLink - Automatically udated when avaialable version is checked. 
 */let config = {}

const downloadRegex = /https:\/\/minecraft\.azureedge\.net\/bin-linux\/.*\.zip/;
const downloadWebpage = 'https://www.minecraft.net/en-us/download/server/bedrock/';
const downloadFileName = 'BedrockServer.zip';
const excludeFiles = [''];
const metadataFile = 'serverData.json';
const subdirectoryBackup = 'backup/'
const subdirectoryDownload = 'download/';

let log = new Logger({});
log.logGeneral = true;
log.logError = true;
log.logWarning = true;
log.logDetail =
log.logDebug = true;

export default class BDSUpdate {
    /**
     * Creates an object which can be used to automatically update Bedrock Dedicate Sever. 
     * @param {Config} updateConfig - the configuration for updating the server.
     */
    constructor(updateConfig) {
        //TODO: config validation
        config = updateConfig;
    }

    async compareVersions() {
        try {
            log.general('BDS Updater - Comparing versions...');
            const currentVersion = await checkCurrentVersion();
            const availableVersion = await checkAvailabkeVersion();
            log.general('BDS Updater - Current version: ' + currentVersion);
            log.general('BDS Updater - Available version: ' + availableVersion);
            if (currentVersion == availableVersion) return {upToDate: true, currentVersion, availableVersion};
            return {upToDate: false, currentVersion, availableVersion};
        } catch (err) {
            log.error('BDS updater - Error comparing current & available versions.');
            log.error(err);
            return {upToDate: false, currentVersion: 'Error', availableVersion: 'Error'}
        }
    }

    async test() {
        await downloadUpdate();
        await backupServer();
        console.log('all done');
    }
}

////////////////////////////
// BDS UPDATER FUNCTIONS 

async function backupServer() {
    let destination = path.join(config.tempLocation, subdirectoryBackup);
    log.detail('BDS Updater - Creating backup of serveer in ' + destination);
    await fs.ensureDir(destination);
    await fs.emptyDir(destination);
    await fs.copy(config.installLocation, destination);
    return true;
}

/**
 * Checks the version of the currently installed server software.
 * @returns {String} - The current BDS version or false if the metadata file is not found.
 */
async function checkCurrentVersion() {
    let file = path.join(config.installLocation, metadataFile);
    if (!await fs.exists(file)) return false;
    let fileContent = await fs.readFile(file);
    let metadata = JSON.parse(fileContent);
    if (metadata.version == undefined) throw new Error('version missing from server metadata @ ' + file);
    return metadata.version;
}

/** 
 * Attempts to grab the link for the most recent BDS download from Minecraft and extracts the version.
 * If a valid update link is found, the config object is updated with a link property. 
 * @returns {String} - The version found in the download link.
 */
async function checkAvailabkeVersion() {
    // link reference: https://minecraft.azureedge.net/bin-linux/bedrock-server-1.14.30.2.zip
    let data = await promiseHttpsRequest(downloadWebpage);
    let link = '' + data.match(downloadRegex);
    if (link == 'null') throw new Error('Unable to locate update link');
    let version = link.replace('https://minecraft.azureedge.net/bin-linux/bedrock-server-', '').replace('.zip', '');
    config.updateLink = link;
    return version;
}

async function downloadUpdate() {
    let destination = path.join(config.tempLocation, subdirectoryDownload);
    let file = path.join(destination, downloadFileName);
    log.detail('BDS Updater - Donlowading update to ' + destination);
    await fs.ensureDir(destination);
    await fs.emptyDir(destination);
    if (!config.updateLink) await checkAvailabkeVersion();
    await promiseHttpsDownload(config.updateLink, file);
    await promiseUnzip(file, destination);
    await fs.unlink(file);
    return true;
}

async function installAddons() {

}

async function installUpdate() {

}

async function serverLaunchTest() {

}

////////////////////////////
// HELPER & MISC FUNCTIONS 

function promiseHttpsDownload(url, destination) {
    return new Promise(function(resolve, reject) {
        const file = fs.createWriteStream(destination);
        const req = https.get(url, res => {
            // pipe output to destination file
            res.pipe(file);
        });
        file.on('finish', function(){
            // once finished, close file and resolve
            file.close(resolve);
        });
        req.on('error', err => {
            // Log errors and reject
            log.error('BDS Updater - Erorr downloading file.');
            reject(err);
        });
        // Send the request
        log.detail('BDS Updater - Downloading file from ' + url);
        log.detail('BDS Updater - Saving file as ' + destination);
        req.end();
    });
}


/**
 * A promise wrapper for sending a get https requests.
 * @param {String} url - The Https address to request.
 * @param {String} options - The request options. 
 */
function promiseHttpsRequest(url, options) {
    if (options == undefined) options = {};
    return new Promise(function(resolve, reject) {
        let req = https.request(url, options, res => {
            //Construct response
            let body = '';
            res.on('data', data => {body += data});
            res.on('end', function() {
                if (res.statusCode == '200') return resolve(body);
                log.warning('BDS Updater - Bad Response ' + res.statusCode);
                reject(res.statusCode);
            });
        });
        log.detail('BDS Updater - Sending request to ' + url);
        req.on('error', error => reject(err));
        req.end();
    }); 
}

/**
 * Extarcts a zip file and resolves an empty promise. 
 * @param {String} file - The path of the archvie to unzip.
 * @param {String} destination - Te location to extract the files to. 
 */
function promiseUnzip(file, destination) {
    log.detail('BDS Updater - Unzipping ' + file);
    return new Promise(function(resolve, reject) {
        let archive = new AdmZip(file);
        archive.extractAllToAsync(destination, true, err => {
            if (err) {
                log.error(`BDS Updater - Error extarcting ${file} to ${destination}.`);
                return reject(err);
            }
            resolve();
        });
    });
}