var HtmlReporter = require("protractor-beautiful-reporter");

exports.config = {
  framework: "jasmine",
  seleniumAddress: "http://localhost:4444/wd/hub",
  specs: ["src/TestSuite/spec.js"],
  capabilities: {
    browserName: "chrome",
    chromeOptions: {
      args: ["--window-size=1920,1080"]
    }
  },
  // multiCapabilities: [{
  //   browserName: 'firefox'
  // }, {
  //   browserName: 'chrome'
  // }]
  
  onPrepare: function() {
    // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
    jasmine.getEnv().addReporter(new HtmlReporter({
        baseDirectory: "tmp/screenshots"
      }).getJasmine2Reporter());
    // let reporter = new HtmlReporter({
    //     baseDirectory: 'tmp/screenshots'
    //  });
  }
};
