const axios = require('axios');
const fs = require('fs');
const vscode = require('vscode');

const client_id = 'Iv1.b507a08c87ecfe98';
const client_version = 'Neovim/0.6.1';
const plugin_version = 'copilot.vim/1.16.0';
const user_agent = 'GithubCopilot/1.155.0';

let token = null;

// Получение токена для GitHub Copilot
const getToken = async () => {
    if (token) return token;

    try {

        const path = vscode.workspace.workspaceFolders[0].uri.path;

        // Проверяем, существует ли файл с токеном
        if (fs.existsSync(path + '/.copilot_token')) {
            const access_token = fs.readFileSync(path + '/.copilot_token', 'utf8');
            token = access_token;
            return token;
        }

        // Шаг 1: Получаем device_code
        const { data } = await axios.post('https://github.com/login/device/code', {
            client_id: client_id,
            scope: 'read:user'
        }, {
            headers: {
                'accept': 'application/json',
                'editor-version': client_version,
                'editor-plugin-version': plugin_version,
                'content-type': 'application/json',
                'user-agent': user_agent,
                'accept-encoding': 'gzip,deflate,br'
            }
        });

        const { device_code, user_code, verification_uri } = data;

        console.log(`Please visit ${verification_uri} and enter code ${user_code} to authenticate.`);

        // Шаг 2: Периодически отправляем запрос, чтобы получить access_token
        let access_token = null;
        while (!access_token) {
            const response = await axios.post('https://github.com/login/oauth/access_token', {
                client_id: client_id,
                device_code: device_code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            }, {
                headers: {
                    'accept': 'application/json',
                    'editor-version': client_version,
                    'editor-plugin-version': plugin_version,
                    'content-type': 'application/json',
                    'user-agent': user_agent,
                    'accept-encoding': 'gzip,deflate,br'
                }
            });

            access_token = response.data.access_token;

            if (!access_token) {
                await new Promise(resolve => setTimeout(resolve, 5000));  // Ожидаем 5 секунд перед повтором
            }
        }

        // Сохраняем токен в файл
        fs.writeFileSync(path + '/.copilot_token', access_token);
        token = access_token;
        console.log('Authentication success!');
        return token;

    } catch (error) {
        console.error('Error during token retrieval:', error);
    }
};

// Генерация кода с использованием GitHub Copilot
const getCopilotCompletion = async (prompt, language = 'en') => {
    try {
        // Получаем токен, если его нет
        await getToken();

        // Отправляем запрос к Copilot для генерации кода
        const response = await axios.post('https://copilot-proxy.githubusercontent.com/v1/engines/copilot-codex/completions', {
            'prompt': '# hello world function\n\n',
            'suffix': '',
            'max_tokens': 1000,
            'temperature': 0,
            'top_p': 1,
            'n': 1,
            'stop': ['\n'],
            'nwo': 'github/copilot.vim',
            'stream': true,
            'extra': {
                'language': 'python'
            }
        }, {
            headers: {
                'Authorization': 'Bearer ' + token, 
            }
        });

        let result = '';
        response.data.choices.forEach(choice => {
            result += choice.text;
        });

        return result;

    } catch (error) {
        console.error('Error generating code:', error);
        return 'Error: Unable to generate completion';
    }
};

// Пример использования
// const prompt = "Write a Python function that adds two numbers";
// getCopilotCompletion(prompt, 'python').then(result => {
//     console.log('Generated code:', result);
// });

module.exports = {
    getCopilotCompletion
};
