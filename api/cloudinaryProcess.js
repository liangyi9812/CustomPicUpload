const formidable = require('formidable');
const fs = require('fs');
const { DateTime } = require('luxon');
const crypto = require('crypto');

require('dotenv').config();

const timeZone = 'Asia/Shanghai';
const config = {
    cloudName: process.env.CLOUD_NAME,
    uploadPreset: process.env.UPLOAD_PRESET,
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET
}

module.exports = async (req, res) => {
    try {
        // 接收处理MWeb发送过来的post请求
        const form = new formidable.IncomingForm();

        form.parse(req, async (err, fields, files) => {
            // 错误处理
            if (err) {
                const errorMsg = 'An error occurred in form parse: ' + err;
                console.error('error in form parse: ', errorMsg);
                res.status(500).json({ error: errorMsg });
                return;
            }
            // 上传的原始文件
            const originUploadedFile = files.file[0];

            const now = DateTime.now().setZone(timeZone);

            const publicID = now.toFormat('/yyyy/MM/dd/') + analyzeUploadFileName(originUploadedFile.originalFilename, now)

            // 创建一个 FormData 实例
            const formData = new FormData();
            formData.append('upload_preset', config.uploadPreset)
            formData.append('api_key', config.apiKey)
            formData.append('public_id', publicID)
            formData.append('file', new Blob([fs.readFileSync(originUploadedFile.filepath)]));

            // 将处理后数据发送给Couldinary

            fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(cloudinaryRes => {
                // 返回 secure_url -> MWeb
                res.status(200).json(cloudinaryRes);
            })
            .catch(error => {
                console.error('An error occurred during cloudinary post:', error);
                res.status(500).json({ error: error.message });
            });
        });
    } catch (error) {
        const errorMsg = 'An error occurred: ' + error;
        console.error('error: ', errorMsg);
        res.status(500).json({ error: errorMsg });
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
    const parts = originFileName.split('.');
    if (parts.length !== 2) {
        throw 'Image fileName analyze fail.' + originFileName;
    }
    const fileName = parts[0];
    const fileExtension = parts[1];
    return `${fileName}_${now.toFormat('yyyyMMdd')}_${randomString(6)}.${fileExtension}`;
}
