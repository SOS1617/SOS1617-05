var exports = module.exports = {};

//CUALES DE ESTAS PRIMERAS LINEAS SOBRAN?
//var express = require("express");
//var bodyParser = require("body-parser");
//var helmet = require("helmet");
//var path = require('path');

exports.register = function(app, port, BASE_API_PATH, checkKey) {

    var url = "mongodb://nachodb:nachodb@ds135690.mlab.com:35690/elections-voting-stats";
    var MongoClient = require('mongodb').MongoClient;
    var db;

    MongoClient.connect(url, {
        native_parser: true
    }, function(err, database) {
        if (err) {
            console.log("CAN NOT CONNECT TO DB: " + err);
            process.exit(1);
        }
        db = database.collection("voting"); // debe especificarse el nombre que se le haya dado a la colección en mlab.com
        app.listen(port, () => {
            console.log("Magic is happening on port " + port);
        });

    });


    // Tarea 1.b feedback F04:
    app.get(BASE_API_PATH + "/elections-voting-stats/loadInitialData", function(request, response) {
        if (!checkKey(request.query.apikey, response)){return;}
        console.log('INFO: Initialiting DB...');
        db.find({}).toArray(function(err, results) { //Se debe usar .toArray, MongoDB no funciona como nedb
            if (err) {
                console.error('WARNING: Error while getting initial data from DB');
                return 0;
            }

            if (results.length === 0) {
                console.log('INFO: Empty DB, loading initial data');

                var provinces = [{
                    "province": "Tarragona",
                    "year": "2016",
                    "pp": "1",
                    "podemos": "1",
                    "psoe": "1",
                    "cs": "1"
                }, {
                    "province": "Asturias",
                    "year": "2016",
                    "pp": "3",
                    "podemos": "2",
                    "psoe": "2",
                    "cs": "1"
                }, {
                    "province": "Sevilla",
                    "year": "2016",
                    "pp": "5",
                    "podemos": "4",
                    "psoe": "3",
                    "cs": "0"
                }];
                db.insert(provinces);
                response.sendStatus(201);
            }
            else {
                console.log('INFO: DB not empty, it has ' + results.length + ' results ');
                response.sendStatus(409);
            }
        });
    });


    // GET a collection
    app.get(BASE_API_PATH + "/elections-voting-stats", function(request, response) {
        console.log("INFO: New GET request to /elections-voting-stats");
        db.find({}).toArray(function(err, results) {
            if (err) {
                console.error('WARNING: Error getting data from DB');
                response.sendStatus(500);
            }
            else {
                console.log("INFO: Sending voting results: " + JSON.stringify(results, 2, null));
                response.send(results);
            }
        });
    });


    // GET a single resource
    app.get(BASE_API_PATH + "/elections-voting-stats/:province", function(request, response) {
        console.log("INFO : new GET request to /elections-voting-stats/:province");
        var province = request.params.province;

        if (!province) {
            console.log("WARNING: New GET request to /elections-voting-stats/:province without province, sending 400...");
            response.sendStatus(400); // bad request
        }
        else {
            console.log("INFO: New GET request to /elections-voting-stats/" + province);
            db.find({
                province: province
            }).toArray(function(err, docs) {
                if (err) {
                    console.error('WARNING: Error getting data from DB');
                    response.sendStatus(500);
                }
                else {
                    if (docs.length === 0) { //LA VERSIÓN DEL PROF. ES IGUAL PERO METE ESTAS DOS SENTENCIAS else if DENTRO DE UN else
                        console.log("WARNING: There are not any voting results for province " + province);
                        response.sendStatus(404);
                    }
                    else {
                        console.log("INFO: Sending voting results: " + JSON.stringify(docs, 2, null));
                        response.send(docs);
                    }
                }
            });
        }
    });

    app.get(BASE_API_PATH + "/elections-voting-stats/:province/:year", function(request, response) {
        var province = request.params.province;
        var year = request.params.year;
        if (!province) {
            console.log("WARNING: New GET request to /elections-voting-stats/:province without province, sending 400...");
            response.sendStatus(400); // bad request
        }
        else if (!year) {
            console.log("WARNING: New GET request to /elections-voting-stats/:province/:year without year, sending 400...");
            response.sendStatus(400); // bad request 

        }
        else {
            console.log("INFO: New GET request to /elections-voting-stats/" + province + year);
            db.find({
                province: province,
                year: year
            }).toArray(function(err, voting) {
                if (err) {
                    console.error('WARNING: Error getting data form DB');
                    response.sendStatus(500); //internal server error
                }
                else {
                    if (voting.length > 0) {
                        var result = voting[0];
                        console.log("INFO: Sending voting results: " + JSON.stringify(result, 2, null));
                        response.send(result);
                    }
                    else {
                        console.log("WARNING: There are not any voting results with year " + year);
                        response.sendStatus(404); // not found
                    }

                }

            });

        }

    });


    //POST over a collection 
    app.post(BASE_API_PATH + "/elections-voting-stats", function(request, response) {
        var newResults = request.body;
        if (!newResults) {
            console.log("WARNING: New POST request to /elections-voting-stats without voting results, sending 400...");
            response.sendStatus(400); // bad request
        }
        else {
            console.log("INFO: New POST request to /elections-voting-stats with body: " + JSON.stringify(newResults, 2, null));
            if (!newResults.province || !newResults.year || !newResults.pp || !newResults.podemos || !newResults.psoe || !newResults.cs) {
                console.log("WARNING: The voting results " + JSON.stringify(newResults, 2, null) + " is not well-formed, sending 422...");
                response.sendStatus(422); // unprocessable entity
            }
            else {
                db.find({
                    province: newResults.province , pp: newResults.pp , psoe: newResults.psoe , podemos: newResults.podemos , cs: newResults.cs
                }).toArray(function(err, res) {
                    if (err) {
                        console.error('WARNING: Error getting data from DB');
                        response.sendStatus(500); // internal server error
                    }
                    else {
                        if (res.length == 1) {
                            console.log("WARNING: The voting results " + JSON.stringify(newResults, 2, null) + " already extis, sending 409...");
                            response.sendStatus(409); // conflict
                        }
                        else {
                            console.log("INFO: Adding voting results " + JSON.stringify(newResults, 2, null));
                            db.insert(newResults);

                            response.sendStatus(201); // created
                        }
                    }
                });




            }

        }

    });


    //POST over a single resource: NO PERMITIDO SEGÚN LA TABLA AZUL, método no permitido
    app.post(BASE_API_PATH + "/elections-voting-stats/:province", function(request, response) {
        console.log("WARNING: Not allowed method.");
        response.sendStatus(405);
    });


    //PUT over a collection: NO PERMITIDO SEGÚN LA TABLA AZUL, método no permitido
    app.put(BASE_API_PATH + "/elections-voting-stats", function(request, response) {
        console.log("WARNING: Not allowed method.");
        response.sendStatus(405);
    });


    //PUT over a single resource: updates a single resource (result) - QUÉ PASA SI SE HACE UN PUT A UN RECURSO QUE NO SE HA CREADO AUN EN LA BASE DE DATOS?
    app.put(BASE_API_PATH + "/elections-voting-stats/:province", function(request, response) {
        var updated = request.body;
        var province = request.params.province;
        if (!updated || province != updated.province) {
            console.log("WARNING: New PUT request to /elections-voting-stats/ without province or with different ID's");
            response.sendStatus(400); // bad request
        }
        else {
            console.log("INFO: New PUT request to /elections-voting-stats/" + province + " with data " + JSON.stringify(updated, 2, null));
            if (!updated.province || !updated.year || !updated.pp || !updated.podemos || !updated.psoe || !updated.cs) {
                console.log("WARNING: The economicSituation " + JSON.stringify(updated, 2, null) + " is not well-formed, sending 422...");
                response.sendStatus(422); // unprocessable entity
            }
            else {
                db.find({}).toArray(function(err, voting) {
                    if (err) {
                        console.error('WARNING: Error getting data from DB');
                        response.sendStatus(500); // internal server error
                    }
                    else {
                        var before = voting.filter((result) => {
                            return (result.province.localeCompare(province, "en", {
                                'sensitivity': 'base'
                            }) === 0);
                        });
                        if (before.length > 0) {
                            db.update({
                                province: province
                            }, voting);
                            console.log("INFO: Modifying economicSituation with province " + province + " with data " + JSON.stringify(voting, 2, null));
                            response.send(voting); // return the updated economic situation
                        }
                        else {
                            console.log("WARNING: There are not any economicSituation with province " + province);
                            response.sendStatus(404); // not found
                        }
                    }
                });

            }

        }

    });


    //DELETE over a collection: hay diferentes maneras de hacerlo
    app.delete(BASE_API_PATH + "/elections-voting-stats", function(request, response) {
        console.log("INFO: New DELETE request to /elections-voting-stats");
        db.remove({}, {
            multi: true
        }, function(err, removed) {
            var numRemoved = JSON.parse(removed);
            console.log("ELIMINADOS: " + numRemoved.n); //numRemoved es un "array" cuyo SEGUNDO ELEMENTO ("n") indica el número de objetos eliminados!!!
            //Por tanto, como se toma el valor de una propiedad en JSON????
            if (err) {
                console.error('WARNING: Error removing data from DB');
                response.sendStatus(500); // internal server error
            }
            else {
                if (numRemoved.n > 0) {
                    console.log("INFO: All the contacts (" + numRemoved.n + ") have been succesfully deleted");
                    response.sendStatus(204); // no content
                }
                else {
                    console.log("WARNING: There are no contacts to delete");
                    response.sendStatus(404); // not found
                }
            }
        });

    });


    //DELETE over a single resource
    app.delete(BASE_API_PATH + "/elections-voting-stats/:province", function(request, response) {
        var province = request.params.province;
        if (!province) {
            console.log("WARNING: New DELETE request to /elections-voting-stats/province without especified province");
            response.sendStatus(400); // bad request
        }
        else {
            db.remove({
                province: province
            }, function(err, removed) {
                var numRemoved = JSON.parse(removed);
                if (err) {
                    console.error('WARNING: Error removing data from DB');
                    response.sendStatus(500); // internal server error
                }
                else {
                    if (numRemoved.n === 1) {
                        console.log("INFO: All the contacts (" + numRemoved.n + ") have been succesfully deleted, sending 204...");
                        response.sendStatus(204); // no content
                    }
                    else {
                        console.log("WARNING: There are no contacts to delete");
                        response.sendStatus(404); // not found
                    }
                }
            });
        }
    });

}