let pageLocators = require("../../src/pageLocators/Locators.js");
let testImpl = require("../../src/combinedPageActions/CombinedPageActions.js");
let testData = require("../../src/TestData/testData.json");
let loc = require("../../src/pageLocators/Locators.js");

describe("Protractor Demo App", function() {

    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000000;
    });

    afterEach(function() {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

  it("Add item to basket and verify", function() {
    browser.ignoreSynchronization = true;
    browser.waitForAngular();
    testImpl.launchApplication(testData.bigBasket.url);
    testImpl.verifyPageTile(testData.bigBasket.homePageTitle);
    testImpl.AddLakmeItemToCart();
    browser.driver.sleep(1000);
    expect(element(by.xpath(loc.ItemsInBasket)).getText()).toContain(testData.bigBasket.cartItemsNum);
    // testImpl.verifyItemIsAddedToCart(testData.bigBasket.cartItemsNum);
});

xit("verify count of friuts and vegetables in bigbasket", function() {
    
    browser.ignoreSynchronization = true;
    browser.waitForAngular();
    testImpl.launchApplication(testData.bigBasket.url);
    testImpl.verifyPageTile(testData.bigBasket.homePageTitle);
    var EC=protractor.ExpectedConditions;
    testImpl.goToVegetablesSection();

    var ele3 = element(by.xpath("//h2[@qa='pageName']/span"))
    browser.wait(EC.visibilityOf(ele3),6000,"Custom Error Message");

    ele3.getText().then(function(text){
        console.log(text);
    });
});

xit("Growth zone", function() {
    browser.ignoreSynchronization = true;
    browser.waitForAngular();
    testImpl.launchApplication(testData.growthZone.url);
    testImpl.loginToGrowthZone(testData.growthZone.userName, testData.growthZone.password);    
});

});
