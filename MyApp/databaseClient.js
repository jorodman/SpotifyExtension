
var mysql = require('mysql');

class DatabaseClient
{
    constructor(host)
    {
        this.options = {
             host: host,
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
