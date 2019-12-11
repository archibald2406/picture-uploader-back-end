const app = require('./app');
const database = require('./database');
const config = require('./config');

database()
    .then(info => {
        console.log(`Connected to ${info.host}:${info.port}/${info.name}.`);
        app.listen(config.PORT, () => {
            console.log(`Listenning at port ${config.PORT}.`)
        });
    }).catch(error => {
        console.error(`Unable to connect to database. ${error}`);
    });