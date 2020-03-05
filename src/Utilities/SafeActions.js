class Browser {
    constructor() {
    }

    appUrl(url_) {
        browser.get(url_);
        return this;
    }

    safeClick(locator_) {
        var EC = protractor.ExpectedConditions;
        var ele = element(locator_);
        browser.wait(EC.visibilityOf(ele),12000,"Element not found");
        ele.click();
    }

    verifyTextPresent(locator_, text_) {
        var EC = protractor.ExpectedConditions;
        var ele = element(locator_);
        browser.wait(EC.visibilityOf(ele),12000,"Element not found");
        expect(element(ele).getText()).toContain(text_);
    }

    verifyTitle(titleText_) {
        expect(browser.getTitle()).toEqual(titleText_);
        return this;
    }

    setUserName(locator_, userName_) {
        var EC=protractor.ExpectedConditions;
        var ele = element(locator_);
        browser.wait(EC.visibilityOf(ele),12000,"Element not found");
        ele.sendKeys(userName_);
    }

    pause(time_) {
        browser.driver.sleep(time_* 1000);
    }



}

module.exports = new Browser();