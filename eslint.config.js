module.exports = [
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                // Node.js globals
                process: "readonly",
                __dirname: "readonly",
                require: "readonly",
                module: "readonly",
                console: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                // Jest globals
                jest: "readonly",
                describe: "readonly",
                test: "readonly",
                expect: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off"
        }
    }
];
