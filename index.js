
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
import fs from 'fs-extra';
import Logger from 'simple-logger';

let log = new Logger({});
log.logGeneral = true;
log.logError = true;
log.logWarning = true;
log.logDetail =
log.logDebug = true;

export default class BSSUpdate {

    constructor() {

    }

    async test() {
        let vCheck = await checkNewVersion();
        log.general(vCheck.link);
        log.general(vCheck.version);
    }
}

////////////////////////////
// BSS UPDATER FUNCTIONS 

/** @typedef versionCheck
 *  @param {String} version - The version found in the download link.
 *  @param {String} link - The download link.
 * 
 * Attempts to grab the link for the most recent BSS download from Minecraft.
 * @returns {versionCheck} - An object containing the version and link. 
 */
async function checkNewVersion() {
    // link reference: https://minecraft.azureedge.net/bin-linux/bedrock-server-1.14.30.2.zip
    const downloadWebpage = 'https://www.minecraft.net/en-us/download/server/bedrock/';
    const downloadRegex = /https:\/\/minecraft\.azureedge\.net\/bin-linux\/.*\.zip/;
    let data = await promiseHttpsRequest(downloadWebpage);
    let link = '' + data.match(downloadRegex);
    if (link == 'null') throw new Error('Unable to locate update link');
    let version = link.replace('https://minecraft.azureedge.net/bin-linux/bedrock-server-', '').replace('.zip', '');
    return {version, link};
}

////////////////////////////
// HELPER & MISC FUNCTIONS 

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
                log.detail('BSS Updater - Bad Response ' + res.statusCode);
                reject(res.statusCode);
            });
        });
        log.detail('BSS Update - Sending request to ' + url);
        req.on('error', error => reject(err));
        req.end();
    }); 
}