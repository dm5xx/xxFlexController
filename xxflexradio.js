class xxFlexRadio {
    constructor(ip, port) 
    {
        this.connect(); 
    }
    connect()
    {
        console.log("Connect to flex");
    }

    isConnected()
    {
        console.log("isConnected");
    }

    fire(cmd)
    {
        console.log("cmd is fired");
    }
}

module.exports = xxFlexRadio; 