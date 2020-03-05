let pageLocators = require("../../src/pageLocators/Locators.js");
let testImpl = require("../../src/combinedPageActions/CombinedPageActions.js");
let testData = require("../../src/TestData/testData.json");
let loc = require("../../src/pageLocators/Locators.js");

describe("CAW Studios assignment", function() {

    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000000;
    });

    afterEach(function() {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      browser.manage().deleteAllCookies();
    browser.executeScript('window.sessionStorage.clear();window.localStorage.clear();');
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

it("verify count of friuts and vegetables in bigbasket", function() {
    
    browser.ignoreSynchronization = true;
    browser.waitForAngular();
    testImpl.launchApplication(testData.bigBasket.url);
    testImpl.verifyPageTile(testData.bigBasket.homePageTitle);
    testImpl.goToVegetablesSection();
    var ele3 = element(by.xpath("//h2[@qa='pageName']")).getText().then(function(txt){ return txt.replace(/\s{2,}/, ' ');});
    testImpl.scrollToShowMoreInVegetablesPage();
    var numbers = element.all(by.xpath("//div[@qa='product']"));
    expect(numbers.count()).toBe(ele3);
});

it("Growth zone", function() {
    browser.ignoreSynchronization = true;
    browser.waitForAngular();
    testImpl.launchApplication(testData.growthZone.url);
    testImpl.loginToGrowthZone(testData.growthZone.userName, testData.growthZone.password);    

    //Cannot login into application because of invalid login credentials
    //Remaining code is not implemented due to above issue
});

});
