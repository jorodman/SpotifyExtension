
var mysql = require('mysql');

class DatabaseClient
{
    constructor()
    {
        this.options = {
             host: '3.141.201.107',
             user: 'remote',
             password: 'RemotePWD1!',
             database: 'spotify'
        };
    }

    async connect()
    {
        this.connection = await mysql.createConnection(this.options);
        console.log("Connected to database");
    }

    // A promisified query so that callbacks don't have to be used
    query (sql)
    {
        return new Promise((resolve, reject) =>
        {
            this.connection.query(sql, (err, results, fields) =>
            {
                if (err)
                {
                    reject(err);
                }
                else
                {
                    resolve(results);
                }
            });
        });
    }

    // Adds a user to the database
    async addUser(id, access_token, refresh_token)
    {
        try
        {
            let sql = "Insert into users (name, access_token, refresh_token) values (\'" + id + "\',\'" + access_token + "\',\'" + refresh_token + "\') on duplicate key update access_token = \'" + access_token + "\', refresh_token = \'" + refresh_token + "\'";
            return await this.query(sql);
        }
        catch(error)
        {
            console.log(error);
            return [];
        }
    }

}

module.exports = DatabaseClient;
