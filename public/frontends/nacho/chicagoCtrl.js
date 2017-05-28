/*global angular*/
/*global Morris*/

angular
    .module("ManagerApp")
    .controller("ChicagoCtrl", ["$http", "$scope", function($http, $scope) {

        // http://jsfiddle.net/gh/get/library/pure/highcharts/highcharts/tree/master/samples/highcharts/demo/column-stacked-percent/

        //LA CUARTA (LA DE ZALANDO ES LA TERCERA) PUEDE SER LA DE CHICAGO (https://data.cityofchicago.org/resource/ydr8-5enu.json?) EN UN GRÁFICO DE BARRAS. Una barra para cada partido y despues una barra 
        //para cada "algo" (por ejemplo: AVE, ST, BVD, RD, etc...) de los datos del json que muestre el gasto (por ejemplo) en ese algo.
        //O también, dado que los recursos tienen fecha, mostrar los gastos en cada año.

        //Spain Elections data (My API)
        $scope.apikey = "cinco";
        $scope.ppValue = 0;
        $scope.podemosValue = 0;
        $scope.psoeValue = 0;
        $scope.csValue = 0;
        $scope.data = {};
        var data = {};

        $scope.st = 0;
        $scope.ave = 0;
        $scope.pl = 0;
        $scope.blvd = 0;
        $scope.ct = 0;
        $scope.pkwy = 0;
        $scope.rd = 0;
        $scope.ter = 0;
        $scope.dr = 0;
        $scope.dataChicago = {};
        var dataChicago = {};


        $http
            .get("/api/v1/elections-voting-stats?apikey=" + $scope.apikey)
            .then(function(res) {

                data = res.data;
                $scope.data = data;
                //data.sort(sort_by('province', true, parseInt));

                for (var i = 0; i < res.data.length; i++) {
                    $scope.ppValue = $scope.ppValue + Number($scope.data[i].pp);
                    $scope.psoeValue = $scope.psoeValue + Number($scope.data[i].psoe);
                    $scope.podemosValue = $scope.podemosValue + Number($scope.data[i].podemos);
                    $scope.csValue = $scope.csValue + Number($scope.data[i].cs);
                }

                $http
                    .get("https://data.cityofchicago.org/resource/ydr8-5enu.json?") //AL ACCEDER A EST URL ME DICE: 301 Moved Permanently !!!!!!
                    .then(function(res) {

                        dataChicago = res.data;
                        $scope.dataChicago = dataChicago;
                        for (var i = 0; i < res.data.length; i++) { //HAY ALGÚN PARTIDO QUE NO SEA ALGUNO DE ESTOS 2 EN EL JSON QUE SE DEVUELVE???
                            console.log("dato: ",$scope.dataChicago[i]);
                            if ($scope.dataChicago[i]._suffix == 'ST') {
                                $scope.st = $scope.st + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'AVE') {
                                $scope.ave = $scope.ave + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'PL') {
                                $scope.pl = $scope.pl + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'BLVD') {
                                $scope.blvd = $scope.blvd + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'CT') {
                                $scope.ct = $scope.ct + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'PKWY') {
                                $scope.pkwy = $scope.pkwy + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'RD') {
                                $scope.rd = $scope.rd + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'TER') {
                                $scope.ter = $scope.ter + Number($scope.dataChicago[i]._amount_paid);
                            }
                            else if ($scope.dataChicago[i]._suffix == 'DR') {
                                $scope.dr = $scope.dr + Number($scope.dataChicago[i]._amount_paid);
                            }
                        }

                        //Quizas no los representa porque son número muy grandes...PROBAR CON PORCENTAJES!!!
                        console.log("Controller intialized. Values... ");
                        console.log("PP: ", $scope.ppValue);
                        console.log("PSOE: ", $scope.psoeValue);
                        console.log("C's: ", $scope.csValue);
                        console.log("PODEMOS: ", $scope.podemosValue);
                        console.log("ST: ", $scope.dpValue);
                        console.log("PL: ", $scope.rpValue);
                        console.log("PKWY: ", $scope.dpValue);
                        console.log("TER: ", $scope.rpValue);
                        
                        //Posibles librerías: morris.js , chartist.js , 
                        
                        new Morris.Bar({
                            element: 'containerChicago',
                            data: [{
                                y: '2006',
                                a: 100,
                                b: 90
                            }, {
                                y: '2007',
                                a: 75,
                                b: 65
                            }, {
                                y: '2008',
                                a: 50,
                                b: 40
                            }, {
                                y: '2009',
                                a: 75,
                                b: 65
                            }, {
                                y: '2010',
                                a: 50,
                                b: 40
                            }, {
                                y: '2011',
                                a: 75,
                                b: 65
                            }, {
                                y: '2012',
                                a: 100,
                                b: 90
                            }],
                            xkey: 'y',
                            ykeys: ['a', 'b'],
                            labels: ['Series A', 'Series B']
                        });


                    });
            });
    }]);
