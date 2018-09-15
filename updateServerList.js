const request = require('request-promise');
const fs = require('fs');

request({
    method: 'GET', uri: 'https://nordvpn.com/api/server', json: true, headers: {
        'User-Agent': 'Request-Promise'
    },
})
    .then((res) => {
        let servers = [];
        res.forEach(e => {
            if (e.features.proxy && e.flag == "CA") {
                servers.push(e.ip_address);
                console.log(e.ip_address)
            }
        });

        servers = JSON.stringify(servers);
        fs.writeFile('./proxyList.json', servers, () => {
            console.log("Finished Writing!")
        })
    }).catch((err) => {
        console.log(err);
    })