var mysql = require('mysql');
var http = require('http');
var request = require('request');
const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('conf/app.properties');

var express = require('express');
var app = express();

var bodyParser = require('body-parser');
// Parse incoming requests data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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
                let PROPERTY_ID = properties.get( 'app_config.cloudbeds.property.id' );
                console.log('cookies: ' + cookies);
                console.log('user_agent: ' + user_agent);
                console.log('property: ' + PROPERTY_ID);
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
    
    get_reservation( query ) {
        let PROPERTY_ID = properties.get( 'app_config.cloudbeds.property.id' );
        return Promise.all([
        	this.default_headers(),
            this.database.get_option( 'hbo_cloudbeds_version' )
        ])
        .then( ([headers, cb_version]) => 
	        this.send_request({
	            url: "https://hotels.cloudbeds.com/connect/reservations/get_reservations",
	            method: "POST",
	            headers: headers,
	            gzip: true,
	            form: {
	            	"sEcho": "2",
	            	"iColumns": "14",
	            	"sColumns": ",,,,,,,,,,,,,",
	            	"iDisplayStart": "0",
	            	"iDisplayLength": "100",
	            	"mDataProp_0": "id",
	            	"sSearch_0": "",
	            	"bRegex_0": "false",
	            	"bSearchable_0": "true",
	            	"bSortable_0": "false",
	            	"mDataProp_1": "identifier",
	            	"sSearch_1": "",
	            	"bRegex_1": "false",
	            	"bSearchable_1": "true",
	            	"bSortable_1": "true",
	            	"mDataProp_2": "first_name",
	            	"sSearch_2": "",
	            	"bRegex_2": "false",
	            	"bSearchable_2": "true",
	            	"bSortable_2": "true",
	            	"mDataProp_3": "last_name",
	            	"sSearch_3": "",
	            	"bRegex_3": "false",
	            	"bSearchable_3": "true",
	            	"bSortable_3": "true",
	            	"mDataProp_4": "booking_date",
	            	"sSearch_4": "",
	            	"bRegex_4": "false",
	            	"bSearchable_4": "true",
	            	"bSortable_4": "true",
	            	"mDataProp_5": "hotel_name",
	            	"sSearch_5": "",
	            	"bRegex_5": "false",
	            	"bSearchable_5": "true",
	            	"bSortable_5": "true",
	            	"mDataProp_6": "room_numbers",
	            	"sSearch_6": "",
	            	"bRegex_6": "false",
	            	"bSearchable_6": "true",
	            	"bSortable_6": "false",
	            	"mDataProp_7": "checkin_date",
	            	"sSearch_7": "",
	            	"bRegex_7": "false",
	            	"bSearchable_7": "true",
	            	"bSortable_7": "true",
	            	"mDataProp_8": "checkout_date",
	            	"sSearch_8": "",
	            	"bRegex_8": "false",
	            	"bSearchable_8": "true",
	            	"bSortable_8": "true",
	            	"mDataProp_9": "nights",
	            	"sSearch_9": "",
	            	"bRegex_9": "false",
	            	"bSearchable_9": "true",
	            	"bSortable_9": "true",
	            	"mDataProp_10": "grand_total",
	            	"sSearch_10": "",
	            	"bRegex_10": "false",
	            	"bSearchable_10": "true",
	            	"bSortable_10": "true",
	            	"mDataProp_11": "",
	            	"sSearch_11": "",
	            	"bRegex_11": "false",
	            	"bSearchable_11": "true",
	            	"bSortable_11": "true",
	            	"mDataProp_12": "",
	            	"sSearch_12": "",
	            	"bRegex_12": "false",
	            	"bSearchable_12": "true",
	            	"bSortable_12": "true",
	            	"mDataProp_13": "id",
	            	"sSearch_13": "",
	            	"bRegex_13": "false",
	            	"bSearchable_13": "true",
	            	"bSortable_13": "false",
	            	"sSearch": "",
	            	"bRegex": "false",
	            	"iSortCol_0": "3",
	            	"sSortDir_0": "asc",
	            	"iSortingCols": "1",
	            	"date_start[0]": "",
	            	"date_start[1]": "",
	            	"date_end[0]": "",
	            	"date_end[1]": "",
	            	"booking_date[0]": "",
	            	"booking_date[1]": "",
	            	"status": "all",
	            	"query": query,
	            	"room_types": "",
	            	"roomsData[0]": "room_numbers",
	            	"source": "assoc-18266,assoc-0,dir-1,dir-2,dir-3,dir-5,dir-0,6-0,7-75119-0,7-75119-1,7-75120-0,7-75120-1,7-80174-1,7-75117-1,7-75121-0,7-75121-1,7-0,8-0,9-80045-1,9-0",
	            	"date_stay[0]": "",
	            	"date_stay[1]": "",
	            	"property_id": PROPERTY_ID,
	            	"group_id": PROPERTY_ID,
	            	"version": cb_version.option_value
	            }
	        }) );
    }
}

app.get('/ping', function (req, res) {

    res.setHeader('Content-Type', 'application/json');
    
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
    
    cbs.ping().then( answer => 
        res.status(200).send({ response : answer }) )
    .catch( console.error );

});

app.post('/lookup_reservation', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
   
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
    
    console.log( "Looking up reservation " + req.body.reservation_id );
    cbs.get_reservation( req.body.reservation_id ).then( answer => {
    		console.log( JSON.stringify( answer ) );
        	res.status(200).send({ response : answer }); 
    	} )
    .catch( err =>
    	res.status(400).send({ success: false, error_message: err })
    );

});

var server = app.listen(8080, function () {

  console.log("cloudbeds_web_api listening on port ", server.address().port)

});
