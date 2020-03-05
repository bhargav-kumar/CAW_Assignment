var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Add item to basket and verify|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "2aada803dc87e9acfd6695918a2fdd99",
        "instanceId": 19192,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: Invalid locator"
        ],
        "trace": [
            "TypeError: Invalid locator\n    at Object.check [as checkedLocator] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:275:9)\n    at thenableWebDriverProxy.findElements (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1041:18)\n    at ptor.waitForAngular.then (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:24:39)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Add item to basket and verify\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:17:3)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583433783620,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433784014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583433784283,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433788272,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=12&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583433796825,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583433797261,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433798109,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433798730,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433800897,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583433814912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433816392,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433816441,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433818787,
                "type": ""
            }
        ],
        "screenShotFile": "00800009-00f5-0078-0071-000f000300ca.png",
        "timestamp": 1583433780039,
        "duration": 41632
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "2aada803dc87e9acfd6695918a2fdd99",
        "instanceId": 19192,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00110015-0021-009d-00fc-00cf008400b6.png",
        "timestamp": 1583433833339,
        "duration": 0
    },
    {
        "description": "Growth zone|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "2aada803dc87e9acfd6695918a2fdd99",
        "instanceId": 19192,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0063006e-00c5-0085-0093-009b00410099.png",
        "timestamp": 1583433833649,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "6c2d712ee2fca9bba1de7748f2eec109",
        "instanceId": 11928,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: Invalid locator"
        ],
        "trace": [
            "TypeError: Invalid locator\n    at Object.check [as checkedLocator] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:275:9)\n    at thenableWebDriverProxy.findElements (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1041:18)\n    at ptor.waitForAngular.then (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:24:39)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Add item to basket and verify\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:17:3)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\pro\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:8633\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583433942852,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583433943498,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433949764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433949804,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=12&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583433955772,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583433956145,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433957950,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433958429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=12&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433960382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583433969887,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583433973327,
                "type": ""
            }
        ],
        "screenShotFile": "00eb0057-002a-00c3-005f-000200f800bd.png",
        "timestamp": 1583433939761,
        "duration": 33369
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "6c2d712ee2fca9bba1de7748f2eec109",
        "instanceId": 11928,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433974417,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583433975128,
                "type": ""
            }
        ],
        "screenShotFile": "006f0095-0084-001b-009a-00d900740049.png",
        "timestamp": 1583433976088,
        "duration": 0
    },
    {
        "description": "Growth zone|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "6c2d712ee2fca9bba1de7748f2eec109",
        "instanceId": 11928,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005000ec-00c6-0065-007a-00d1008900a0.png",
        "timestamp": 1583433976459,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fbb43ec8b8e97f3693379ed3a8cc99cd",
        "instanceId": 42056,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583435293355,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583435294041,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583435299517,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583435300162,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583435304177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583435304720,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583435305012,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583435305032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583435305748,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583435313106,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583435313511,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583435313680,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583435315621,
                "type": ""
            }
        ],
        "screenShotFile": "00f500df-00c9-00ca-0020-004900b70096.png",
        "timestamp": 1583435290565,
        "duration": 25645
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "fbb43ec8b8e97f3693379ed3a8cc99cd",
        "instanceId": 42056,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "001b00f8-0059-00e4-00cc-00b400bd00fc.png",
        "timestamp": 1583435316909,
        "duration": 0
    },
    {
        "description": "Growth zone|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "fbb43ec8b8e97f3693379ed3a8cc99cd",
        "instanceId": 42056,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00850087-0081-00bd-0088-000f00fa00e3.png",
        "timestamp": 1583435316925,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "63a9545bb60ff26308af7bd986261e47",
        "instanceId": 34492,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: Element not found\nWait timed out after 12023ms"
        ],
        "trace": [
            "TimeoutError: Element not found\nWait timed out after 12023ms\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2201:17\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>\n    at process._tickCallback (internal/process/next_tick.js:189:7)\nFrom: Task: Element not found\n    at scheduleWait (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2188:20)\n    at ControlFlow.wait (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2517:12)\n    at thenableWebDriverProxy.wait (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:934:29)\n    at run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ProtractorBrowser.to.(anonymous function) [as wait] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:67:16)\n    at Browser.safeClick (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\Utilities\\SafeActions.js:13:17)\n    at BigBasketActionMethods.addItemToBasket (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\pageActionMethods\\BigBasket.js:30:21)\n    at pageCombinedActionMethods.AddLakmeItemToCart (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\combinedPageActions\\CombinedPageActions.js:23:30)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:22:14)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\nFrom: Task: Run it(\"Add item to basket and verify\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:17:3)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583437285071,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583437286256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583437291816,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583437294899,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583437301702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583437302558,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583437303767,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583437304018,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583437306794,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0082-0044-00bf-0017-007300930022.png",
        "timestamp": 1583437281779,
        "duration": 38200
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "63a9545bb60ff26308af7bd986261e47",
        "instanceId": 34492,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583437327339,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583437327340,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583437327340,
                "type": ""
            }
        ],
        "screenShotFile": "00a20001-0007-00d8-0061-006900810046.png",
        "timestamp": 1583437327328,
        "duration": 0
    },
    {
        "description": "Growth zone|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "63a9545bb60ff26308af7bd986261e47",
        "instanceId": 34492,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "000000c5-0033-0015-0057-003700200012.png",
        "timestamp": 1583437327377,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f88a0b133850051a77551b31f1f4c9",
        "instanceId": 8884,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583438022068,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583438022427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583438027434,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583438028321,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583438034533,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583438034874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583438035334,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583438035657,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583438036008,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583438042279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583438043163,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583438043240,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583438045185,
                "type": ""
            }
        ],
        "screenShotFile": "00920030-0087-00d7-004b-003300100079.png",
        "timestamp": 1583438018398,
        "duration": 28093
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "e0f88a0b133850051a77551b31f1f4c9",
        "instanceId": 8884,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00fa00d3-006b-00c7-00c2-0041005700d4.png",
        "timestamp": 1583438047522,
        "duration": 0
    },
    {
        "description": "Growth zone|Protractor Demo App",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "e0f88a0b133850051a77551b31f1f4c9",
        "instanceId": 8884,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "005d00d0-0076-006e-007c-00590041002f.png",
        "timestamp": 1583438047545,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "5813f24c257dfe6faf8b196ee35bc48d",
        "instanceId": 21364,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00a8004f-0086-005a-0085-007e00870027.png",
        "timestamp": 1583440675943,
        "duration": 5
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "5813f24c257dfe6faf8b196ee35bc48d",
        "instanceId": 21364,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00c100ec-008b-0035-006d-00a7008f00ea.png",
        "timestamp": 1583440678349,
        "duration": 0
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5813f24c257dfe6faf8b196ee35bc48d",
        "instanceId": 21364,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa 158:1057 Uncaught ReferenceError: jQuery is not defined",
                "timestamp": 1583440687209,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583440693114,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583440697596,
                "type": ""
            }
        ],
        "screenShotFile": "00ce00e6-0099-00fd-004e-003d000f0097.png",
        "timestamp": 1583440678410,
        "duration": 21971
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "0b4525adfb3b1e5fc8ec2fb2923ce430",
        "instanceId": 24980,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "007e00c5-005c-005a-0008-00e1005e0096.png",
        "timestamp": 1583440757962,
        "duration": 3
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "0b4525adfb3b1e5fc8ec2fb2923ce430",
        "instanceId": 24980,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "006900e8-006f-0064-00ec-0023003a0041.png",
        "timestamp": 1583440758047,
        "duration": 0
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0b4525adfb3b1e5fc8ec2fb2923ce430",
        "instanceId": 24980,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa 158:1057 Uncaught ReferenceError: jQuery is not defined",
                "timestamp": 1583440762770,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583440765352,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583440769854,
                "type": ""
            }
        ],
        "screenShotFile": "00c10085-0021-0001-00ca-00f100120000.png",
        "timestamp": 1583440758163,
        "duration": 13508
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "346ed3ec82892f03fee4684a66f73790",
        "instanceId": 38660,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "0003007f-007d-0022-00fd-004100c1004e.png",
        "timestamp": 1583441272912,
        "duration": 3
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "346ed3ec82892f03fee4684a66f73790",
        "instanceId": 38660,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00050058-0090-0039-003e-0015007a00b0.png",
        "timestamp": 1583441272989,
        "duration": 0
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "346ed3ec82892f03fee4684a66f73790",
        "instanceId": 38660,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b3008c-004e-001d-003f-000c001c0013.png",
        "timestamp": 1583441273082,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "7eb91fa143e3cf2008eab6772c279621",
        "instanceId": 1900,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "004e0042-001a-0017-00aa-008c0051003e.png",
        "timestamp": 1583441285659,
        "duration": 1
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "7eb91fa143e3cf2008eab6772c279621",
        "instanceId": 1900,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00b50021-0097-00e9-0066-00be008f00a2.png",
        "timestamp": 1583441285724,
        "duration": 0
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": false,
        "pending": true,
        "os": "windows",
        "sessionId": "7eb91fa143e3cf2008eab6772c279621",
        "instanceId": 1900,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Temporarily disabled with xit",
        "browserLogs": [],
        "screenShotFile": "00fd00d1-0086-00b8-0002-00fc00ab00c2.png",
        "timestamp": 1583441285771,
        "duration": 0
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "90ffd2943c6fbd072c4ee1c584e48b31",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583441848112,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583441848892,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583441857590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583441859041,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583441859676,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583441859955,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441859992,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441861391,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583441868995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583441869001,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441869654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441870894,
                "type": ""
            }
        ],
        "screenShotFile": "00ad0059-00f3-0094-0071-00e9007700ef.png",
        "timestamp": 1583441845123,
        "duration": 31825
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "90ffd2943c6fbd072c4ee1c584e48b31",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //h2[normalize-space(text())='Fruits & Vegetables'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //h2[normalize-space(text())='Fruits & Vegetables'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>\n    at process._tickCallback (internal/process/next_tick.js:189:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:35:89)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify count of friuts and vegetables in bigbasket\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:28:1)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583441895233,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583441895976,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583441897564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441897782,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441899330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583441901253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583441901802,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583441902519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441902536,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441903559,
                "type": ""
            }
        ],
        "screenShotFile": "004f005c-006c-00d9-0057-00df006c00bd.png",
        "timestamp": 1583441877525,
        "duration": 37140
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "90ffd2943c6fbd072c4ee1c584e48b31",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa 158:1057 Uncaught ReferenceError: jQuery is not defined",
                "timestamp": 1583441923762,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583441932713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583441937324,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441943295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583441943511,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:2499 \"[LEADFOX]\" \"Could not find client associated to key\" \"21dc6dbbb53007a0e0ae4a2e4aa6e877\"",
                "timestamp": 1583441946358,
                "type": ""
            }
        ],
        "screenShotFile": "00170088-009c-00d9-000f-006b00a8000f.png",
        "timestamp": 1583441916195,
        "duration": 31325
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a4c148b2c2f9980902328edf7b507aeb",
        "instanceId": 29360,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442462683,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442463876,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442467951,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442469300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442472864,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442474075,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442475251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442475780,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442477908,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583442482260,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442482905,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442482975,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442484967,
                "type": ""
            }
        ],
        "screenShotFile": "00a40025-004e-00fe-00e2-00c90033002f.png",
        "timestamp": 1583442460163,
        "duration": 32858
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "a4c148b2c2f9980902328edf7b507aeb",
        "instanceId": 29360,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //h2[normalize-space(@qa)='pageName'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //h2[normalize-space(@qa)='pageName'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>\n    at process._tickCallback (internal/process/next_tick.js:189:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:37:75)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify count of friuts and vegetables in bigbasket\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:30:1)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442496791,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442497613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442498421,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442498670,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442500085,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442500701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442501751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442502860,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442502983,
                "type": ""
            }
        ],
        "screenShotFile": "00fb008e-0049-0006-00c4-00d700f4007c.png",
        "timestamp": 1583442493524,
        "duration": 17117
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a4c148b2c2f9980902328edf7b507aeb",
        "instanceId": 29360,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa 158:1057 Uncaught ReferenceError: jQuery is not defined",
                "timestamp": 1583442516059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583442521774,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.\\\\\\x7e \\x7e,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583442526085,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442529754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442529905,
                "type": ""
            }
        ],
        "screenShotFile": "00260072-0050-00e3-009d-00a4003a0017.png",
        "timestamp": 1583442511365,
        "duration": 20974
    },
    {
        "description": "Add item to basket and verify|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "99e311ae872d302f4d1b92e2428cbb52",
        "instanceId": 36720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:19193\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442740862,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442741363,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442745105,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442746256,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&%20Hygiene&t_pos_sec=11&t_pos_item=1&t_ch=desktop:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442748115,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442748644,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442748822,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442748993,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pc/beauty-hygiene/makeup/?nc=Beauty%20&%20Hygiene&%20Hygiene&t_pg=Mar-HomePage-T1&t_p=Mar-T1_2020&t_s=Beauty%20&t_pos_sec=11&t_pos_item=1&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442749329,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.beyondsecurity.com/verification-images/www.bigbasket.com/vulnerability-scanner-2.gif - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1583442756461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442756883,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442756997,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/pd/40007165/lakme-eyeconic-kajal-black-035-g-twist-up-pencil/?nc=L2Category&t_pg=L2Cagegory&t_p=L2Category&t_s=L2Category&t_pos=3&t_ch=desktop - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442758801,
                "type": ""
            }
        ],
        "screenShotFile": "00b9005f-00da-00df-000a-007100a00019.png",
        "timestamp": 1583442736734,
        "duration": 29041
    },
    {
        "description": "verify count of friuts and vegetables in bigbasket|CAW Studios assignment",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "99e311ae872d302f4d1b92e2428cbb52",
        "instanceId": 36720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //h2[@qa='pageName'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //h2[@qa='pageName'])\n    at elementArrayFinder.getWebElements.then (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at <anonymous>\n    at process._tickCallback (internal/process/next_tick.js:189:7)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.(anonymous function).args [as getText] (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:37:58)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"verify count of friuts and vegetables in bigbasket\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:30:1)\n    at addSpecsToSuite (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\chbha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Projects\\Javascript\\VisualStudioCodeProjects\\protractorTest\\cawstudios_assignment\\CAW_Assignment\\src\\TestSuite\\spec.js:6:1)\n    at Module._compile (module.js:653:30)\n    at Object.Module._extensions..js (module.js:664:10)\n    at Module.load (module.js:566:32)\n    at tryModuleLoad (module.js:506:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442768281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442768624,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at d.$apply (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12653)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:8633\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535 \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442769257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442770018,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442770864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js 5:30823 TypeError: Cannot read property 'filter' of undefined\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:30948\n    at Object.t [as filter] (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:3:29970)\n    at https://www.bigbasket.com/static/v2239/custPage/build/all.min.js:5:7107\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:5129\n    at d.$digest (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:10731)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:7:12454\n    at r (https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:24086)\n    at https://www.bigbasket.com/static/v2239/custPage/build/vendor.min.js:5:25535\n    at nrWrapper (https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb:45:16543) \"Possibly unhandled rejection: {}\"",
                "timestamp": 1583442772947,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - [DOM] Found 2 elements with non-unique id #{{ $select.focusserId }}: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1583442773491,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://connect.facebook.net/en_US/fbevents.js 22:6165 \"[Facebook Pixel] - Duplicate Pixel ID: 1395135667375657.\"",
                "timestamp": 1583442774569,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442776281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.bigbasket.com/cl/fruits-vegetables/?nc=nb - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442778780,
                "type": ""
            }
        ],
        "screenShotFile": "00fa00ac-0019-00d7-00f9-00a10013008a.png",
        "timestamp": 1583442766259,
        "duration": 15768
    },
    {
        "description": "Growth zone|CAW Studios assignment",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "99e311ae872d302f4d1b92e2428cbb52",
        "instanceId": 36720,
        "browser": {
            "name": "chrome",
            "version": "80.0.3987.122"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.~ ~,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583442791286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://app.leadfox.co/js/api/init.js?key=21dc6dbbb53007a0e0ae4a2e4aa6e877 0:58 \"\\n    |\\\\__/|\\n   /     \\\\\\n  /_.~ ~,_\\\\   -- The fox says: You are still using the old LeadFox tracking code, please update! \\n\\t \\\\@/\\n\\n\"",
                "timestamp": 1583442796319,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442799073,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://growthzonedev.com/auth?ReturnUrl=%2fa - A cookie associated with a cross-site resource at http://www.facebook.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1583442799588,
                "type": ""
            }
        ],
        "screenShotFile": "00b900ba-00cd-00c4-0070-00790031004a.png",
        "timestamp": 1583442783036,
        "duration": 17961
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
