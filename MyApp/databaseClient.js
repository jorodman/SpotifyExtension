
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
        console.log("connected");
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
            let sql = "Insert into users (name, access_token, refresh_token, fourWeekPlaylist, sixMonthPlaylist, allTimePlaylist) values (\'" + id + "\',\'" + access_token + "\',\'" + refresh_token + "\', 0, 0, 0) on duplicate key update access_token = \'" + access_token + "\', refresh_token = \'" + refresh_token + "\', fourWeekPlaylist=0, sixMonthPlaylist=0, allTimePlaylist=0";
            let result = await this.query(sql);
            return result;
        }
        catch(error)
        {
            console.log(error);
            return [];
        }
    }

}

module.exports = DatabaseClient;
