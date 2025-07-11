module.exports = {
  apps: [{
    name: 'ai-dev-team',
    script: 'dist/index.js',
    watch: false,
    restart_delay: 2000,
    autorestart: false
  }]
};