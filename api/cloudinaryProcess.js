const axios = require('axios');
const formidable = require('formidable');
const moment = require('moment');

require('dotenv').config();
moment.locale('zh-cn');

const config = {
    cloudName: process.env.CLOUD_NAME,
    uploadPreset: process.env.UPLOAD_PRESET,
    apiKey: process.env.API_KEY,
    signature: process.env.SIGNATURE
}

module.exports = async (req, res) => {
    try {

        // 接收处理MWeb发送过来的post请求
        const form = new formidable.IncomingForm();

        form.parse(req, async (err, { }, files) => {
            // 错误处理
            if (err) {
                const errorMsg = 'An error occurred in form parse: ' + err;
                console.error('error in form parse: ', errorMsg);
                res.status(500).json({ error: errorMsg });
                return;
            }
            // 上传的原始文件
            const originUploadedFile = files.file;
            const now = moment();
            const publicID = now.format('/YYYY/MM/DD/') + analyzeUploadFileName(originUploadedFile.name, now)

            // 创建一个 FormData 实例
            const formData = new FormData();
            formData.append('file', originUploadedFile, {
                upload_preset: config.uploadPreset,
                api_key: config.apiKey,
                signature: config.signature,
                timestamp: moment().valueOf(),
                public_id: publicID
            });

            // 将处理后数据发送给Couldinary
            const cloudinaryRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData, {
                headers: {
                    ...formData.getHeaders() // 设置适当的请求头，包括 Content-Type
                }
            });
            
            // 返回secure_url -> MWeb
            res.status(200).json({ secure_url: cloudinaryRes.data['secure_url'] });
        });
    } catch (error) {
        const errorMsg = 'An error occurred: ' + err;
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
    return `${fileName}_${now.format('YYYYMMDD')}_${randomString(6)}.${fileExtension}`;
}