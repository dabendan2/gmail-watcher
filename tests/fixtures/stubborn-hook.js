
// This hook traps SIGTERM and refuses to die immediately
console.log('Stubborn hook started');

process.on('SIGTERM', () => {
    console.log('Caught SIGTERM, ignoring it!');
    // Keep running
});

// Keep process alive
setInterval(() => {
    console.log('Still alive...');
}, 500);
