require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DateTime } = require('luxon');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const timeZone = 'Asia/Shanghai';
const now = DateTime.now().setZone(timeZone);

const storage = multer.diskStorage({
    filename: (req, file, callback) => callback(null, analyzeUploadFileName(file.originalname, now))
});
const upload = multer({ storage });

const config = {
    cloudName: process.env.CLOUD_NAME || undefined,
    uploadPreset: process.env.UPLOAD_PRESET || undefined,
    apiKey: process.env.API_KEY || undefined,
    apiSecret: process.env.API_SECRET || undefined,
    uploadKey: process.env.UPLOAD_KEY || undefined
}

module.exports = async (req, res) => {
    try {

        // 验证配置值是否为空
        if (
            !config.cloudName ||
            !config.uploadPreset ||
            !config.apiKey ||
            !config.apiSecret ||
            !config.uploadKey
        ) {
            throw new Error('Configuration values cannot be undefined or empty.');
        }

        upload.single('file')(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    state: 'upload parse',
                    error: err
                });
            } else if (!req.body.uploadKey || req.body.uploadKey != config.uploadKey) {
                return res.status(400).json({
                    state: 'uploadKey',
                    error: 'wrong uploadKey'
                });
            }
            const uploadFile = req.file
            if (!uploadFile) {
                return res.status(400).json({
                    state: 'file uploaded',
                    error: 'no file uploaded'
                });
            }

            // build cloudinary folder path
            const publicID = now.toFormat('/yyyy/MM/dd/') + path.parse(uploadFile.filename).name

            // build signature
            const timestamp = Math.round(new Date().getTime() / 1000)
            const paramsToSign = {
                timestamp: timestamp, // current timestamp
                upload_preset: config.uploadPreset,
                public_id: publicID
            };
            const serialString = Object.keys(paramsToSign).sort().map(key => key + '=' + paramsToSign[key]).join('&') + config.apiSecret
            console.log('serialString: ' + serialString);
            const signature = crypto
                .createHash('sha1')
                .update(serialString)
                .digest('hex');

            // sign upload  
            const formData = new FormData();
            formData.append('file', fs.createReadStream(uploadFile.path));
            formData.append('upload_preset', config.uploadPreset)
            formData.append('api_key', config.apiKey);
            formData.append('signature', signature);
            formData.append('timestamp', timestamp)
            formData.append('public_id', publicID);

            // send request
            axios({
                method: 'POST',
                url: `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
                data: formData
            })
                .then(response => res.status(200).json(response.data))
                .catch(error => {
                    res.status(500).json({
                        state: 'An error occurred during cloudinary request',
                        error: error
                    });
                });
        });
    } catch (error) {
        console.error(JSON.stringify(error))
        res.status(500).json({
            state: 'An error occurred during try block',
            error: error.message
        });
    }
};


function analyzeUploadFileName(originFileName, now) {
    function randomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';

        while (result.length < length) {
            const randomBytes = crypto.randomBytes(length);
            for (let i = 0; i < randomBytes.length && result.length < length; i++) {
                const randomIndex = randomBytes[i] % characters.length;
                result += characters.charAt(randomIndex);
            }
        }

        return result;
    }
    const pathParse = path.parse(originFileName)
    const fileName = pathParse.name;
    const fileExtension = pathParse.ext;
    return `${fileName}_${now.toFormat('yyyyMMdd')}_${randomString(6)}${fileExtension}`;
}
