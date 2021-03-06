/*global angular*/
/*global EJSC*/

angular
    .module("ManagerApp")
    .controller("AnalyticsCtrl", ["$http", "$scope", function($http, $scope) {

        $scope.apikey = "cinco";

        $scope.pp = [];
        $scope.podemos = [];
        $scope.psoe = [];
        $scope.cs = [];
        $scope.dataElections = {};
        var dataElections = {};

        $scope.gdp = [];
        $scope.debt = [];
        $scope.dataEconomic = {};
        var dataEconomic = {};


        $http
            .get("/api/v1/elections-voting-stats?apikey=" + $scope.apikey)
            .then(function(res) {

                dataElections = res.data;
                $scope.dataElections = dataElections;

                for (var i = 0; i < res.data.length; i++) {
                    $scope.pp.push([$scope.dataElections[i].province.slice(0, 3), Number($scope.dataElections[i].pp)]);
                    $scope.psoe.push([$scope.dataElections[i].province.slice(0, 3), Number($scope.dataElections[i].psoe)]);
                    $scope.podemos.push([$scope.dataElections[i].province.slice(0, 3), Number($scope.dataElections[i].podemos)]);
                    $scope.cs.push([$scope.dataElections[i].province.slice(0, 3), Number($scope.dataElections[i].cs)]);

                }
                console.log("ELECTIONS DATA: ", $scope.pp);

                $http
                    .get("/api/v1/economic-situation-stats?" + "apikey=" + $scope.apikey)
                    .then(function(res) {
                        dataEconomic = res.data;
                        $scope.dataEconomic = dataEconomic;

                        for (var i = 0; i < res.data.length; i++) {
                            $scope.gdp.push([$scope.dataEconomic[i].province.slice(0, 3), Number($scope.dataEconomic[i].gdp) / 100]);
                            $scope.debt.push([$scope.dataEconomic[i].province.slice(0, 3), Number($scope.dataEconomic[i].debt) / 100]);
                        }

                        console.log("ECONOMIC DATA (gdp): ", $scope.gdp);
                        console.log("ECONOMIC DATA (debt): ", $scope.debt);

                        var chart = new EJSC.Chart("containerBoth", {
                            title: 'SOS1617-05 Integration ©',
                            axis_bottom: {
                                caption: 'Province',
                            },
                            axis_left: {
                                caption: 'Seats or €',
                            }
                        });

                        var scatterSeries1 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.pp), {
                                title: "PP",
                                useColorArray: true,
                                color: "rgb(30,144,255)",
                                pointStyle: "box"
                            }
                        );

                        var scatterSeries2 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.psoe), {
                                title: "PSOE",
                                useColorArray: true,
                                color: "rgb(255,0,0)",
                                pointStyle: "triangle"
                            }
                        );

                        var scatterSeries3 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.podemos), {
                                title: "PODEMOS",
                                useColorArray: true,
                                color: "rgb(153,0,153)",
                                pointStyle: "circle"
                            }
                        );

                        var scatterSeries4 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.cs), {
                                title: "C's",
                                useColorArray: true,
                                color: "rgb(255,128,0)",
                                pointStyle: "diamond"
                            }
                        );

                        var scatterSeries5 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.gdp), {
                                title: "GDP",
                                useColorArray: true,
                                color: "rgb(96,96,96)",
                                pointStyle: "diamond"
                            }
                        );

                        var scatterSeries6 = new EJSC.ScatterSeries(
                            new EJSC.ArrayDataHandler($scope.debt), {
                                title: "DEBT",
                                useColorArray: true,
                                color: "rgb(255,255,0)",
                                pointStyle: "diamond"
                            }
                        );

                        chart.addSeries(scatterSeries1);
                        chart.addSeries(scatterSeries2);
                        chart.addSeries(scatterSeries3);
                        chart.addSeries(scatterSeries4);
                        chart.addSeries(scatterSeries5);
                        chart.addSeries(scatterSeries6);

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries1, "linear", { //PP
                            color: "rgb(30,144,255)"
                        }));

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries2, "linear", { //PSOE
                            color: "rgb(255,0,0)"
                        }));

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries3, "linear", { //PODEMOS
                            color: "rgb(153,0,153)"
                        }));

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries4, "linear", { //C'S
                            color: "rgb(255,128,0)"
                        }));

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries5, "linear", { //GDP
                            color: "rgb(96,96,96)"
                        }));

                        chart.addSeries(new EJSC.TrendSeries(scatterSeries6, "linear", { //DEBT
                            color: "rgb(255,255,0)"
                        }));
                    });
            });
    }]);
