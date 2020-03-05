let safeActions = require("../../src/Utilities/SafeActions.js");
let pageLocators = require("../../src/pageLocators/Locators.js");

class BigBasketActionMethods {
    constructor() {
    }

    launchApplication(url_) {
        safeActions.appUrl(url_);
        return this;
    }

    verifyTitle(pageTitle_) {
        safeActions.verifyTitle(pageTitle_);
        
    }

    clickOnBeautyAndHygiene() {
        safeActions.pause(3);
        safeActions.safeClick(by.xpath(pageLocators.beatyANdHygiene));
        return this;
    }

    clickOnLakmeItem() {
        safeActions.safeClick(by.xpath(pageLocators.lakme));
        return this;
    }

    addItemToBasket() {
        safeActions.safeClick(by.xpath(pageLocators.addToBasket));
        return this;
    }

    verifyItemAddedToCart(text_) {
        safeActions.verifyTextPresent(by.xpath(pageLocators.ItemsInBasket), text_);
        return this;
    }

    clickOnCategory() {
        safeActions.safeClick(by.xpath(pageLocators.category));
        return this;
    }

    goToVegetable() {
        safeActions.safeClick(by.xpath(pageLocators.vegetables));
        return this;
    }

    scrollToShowMore() {
        safeActions.moveToElement(by.xpath(pageLocators.showMore));
        return this;
    }

}

module.exports = new BigBasketActionMethods();