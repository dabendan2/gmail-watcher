const fs = require('fs');
const path = require('path');

module.exports = (program) => {
  const config = program.command('config')
    .description('Manage configuration parameters');

  config.command('set <key> <value>')
    .description('Set a configuration parameter')
    .action((key, value, options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');
        
      const configPath = path.join(workdir, 'config.json');
      let data = {};
      
      if (fs.existsSync(configPath)) {
        try {
          data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
          // ignore parsing error, overwrite
        }
      }
      
      data[key] = value;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      console.log(`Config set: ${key} = ${value}`);
    });

  config.command('list')
    .description('List all configuration parameters')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const configPath = path.join(workdir, 'config.json');
      
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        console.log(data);
      } else {
        console.log('{}');
      }
    });
};
