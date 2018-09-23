var mysql = require('mysql');
var http = require('http');
var request = require('request');
const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('conf/app.properties');

class Database {
    constructor( config ) {
        this.connection = mysql.createConnection( config );
    }
    query( sql, args ) {
        return new Promise( ( resolve, reject ) => {
            this.connection.query( sql, args, ( err, rows ) => {
                console.log('Connected as id ' + this.connection.threadId);
                if ( err )
                    return reject( err );
                resolve( rows );
            } );
        } );
    }
    close() {
        return new Promise( ( resolve, reject ) => {
            this.connection.end( err => {
                if ( err )
                    return reject( err );
                resolve();
            } );
        } );
    }
    // returns last 10 jobs in JSON object
    get_last_10_jobs() {
        return new Promise( ( resolve, reject ) => {
			this.query( 'SELECT * FROM wp_lh_jobs j order by j.job_id desc limit 10' )
		        .then( rows => resolve( '[' + rows.map( JSON.stringify ).join( "," ) + ']' ),
		               err => { throw err; } )
		        .catch( err => {
		            // handle the error
		            console.log('error: ' + err.stack);
		            reject( err );
		        } );
        } );
    }
    
    get_option( option_name ) {
        return new Promise( ( resolve, reject ) => {
            this.query( 'SELECT * FROM ' + properties.get( 'db_config.wordpress.db.prefix' ) + 'options'
                      + ' WHERE option_name = ?', [ option_name ] )
                .then( rows => resolve( rows.length ? rows[0] : null ),
                       err => { throw err; } )
                .catch( err => {
                    // handle the error
                    console.log('error: ' + err.stack);
                    reject( err );
                } );
        } );
    }

}

class CloudbedsService {
    constructor( db ) {
        this.database = db;
    }

    send_request( params ) {
        return new Promise( ( resolve, reject ) => {
            request( params, function ( error, response, body ) {
                if( error ) {
                    reject( error );
                }
                else {
console.log('response: ' + JSON.stringify(response));
console.log('body: ' + JSON.stringify(body));
                    resolve( body );
                }
            });

        } );
    }
    
    default_headers() {
        return new Promise( ( resolve, reject ) => {
            Promise.all([
                this.database.get_option( 'hbo_cloudbeds_cookies' ),
                this.database.get_option( 'hbo_cloudbeds_useragent' )
            ])
            .then( ([cookies, user_agent]) => {
                let PROPERTY_ID = 17363;
                console.log('cookies: ' + cookies);
                console.log('user_agent: ' + user_agent);
                resolve( {
                        "Accept" : "application/json, text/javascript, */*; q=0.01",
                        "Content-Type" : "application/x-www-form-urlencoded; charset=UTF-8",
                        "Referer" : "https://hotels.cloudbeds.com/connect/" + PROPERTY_ID,
                        "Accept-Language" : "en-GB,en-US;q=0.9,en;q=0.8",
                        "Accept-Encoding" : "gzip, deflate, br",
                        "X-Requested-With" : "XMLHttpRequest",
                        "X-Used-Method" : "common.ajax",
                        "Cache-Control" : "max-age=0",
                        "Origin" : "https://hotels.cloudbeds.com",
                        "User-Agent" : user_agent.option_value,
                        "Cookie" : cookies.option_value
                } );
            } )
            .catch( err => {
                // handle the error
                console.log('error: ' + err.stack);
                reject( err );
            } );
        } );
    }
    
    ping() {
        return this.default_headers().then( headers =>
            this.send_request({
                url: "https://hotels.cloudbeds.com/error/ping",
                method: "POST",
                headers: headers
            }) );
    }
}

http.createServer( function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    
    let db_config = properties.path().db_config;
    if( ! db_config ) {
        throw Error( 'Missing db_config properties' );
    }

    const db = new Database( {
        host     : db_config.host,
        database : db_config.database,
        user     : db_config.user,
        password : db_config.password
    } );
    
    const cbs = new CloudbedsService( db );
    

(async () => {
  try {
    let ping_response = await cbs.ping();
    console.log( 'ping_response: ' + ping_response );
    res.write( JSON.stringify( ping_response ) );

  }  catch (e) {
    console.error(e);
  }
    db.close(); 
    res.end();
})();

}).listen(8080);
