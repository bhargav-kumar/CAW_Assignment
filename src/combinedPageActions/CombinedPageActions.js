let growthZonePageActions = require("../pageActionMethods/GrowthZone.js");
let bigBasketPageActions = require("../pageActionMethods/BigBasket.js");

class pageCombinedActionMethods {
    constructor() { 
    }


    launchApplication(url_) {
        growthZonePageActions.launchApplication(url_);
        return this;
    }

    loginToGrowthZone(userName_, password_) {
        growthZonePageActions.setUserName(userName_);
        growthZonePageActions.setPassword(password_);
        growthZonePageActions.clickOnGrowthZoneLoginButton();
    }
   
    AddLakmeItemToCart() {
        bigBasketPageActions.clickOnBeautyAndHygiene();
        bigBasketPageActions.clickOnLakmeItem();
        bigBasketPageActions.addItemToBasket();
    }

    verifyPageTile(pageTitle_) {
        bigBasketPageActions.verifyTitle(pageTitle_);
    }

    verifyItemIsAddedToCart(itemNum_) {
        bigBasketPageActions.verifyItemAddedToCart(itemNum_);
    }

    goToVegetablesSection() {
        bigBasketPageActions.clickOnCategory();
        bigBasketPageActions.goToVegetable();
    }

    scrollToShowMoreInVegetablesPage() {
        bigBasketPageActions.scrollToShowMore();
    }

}

module.exports = new pageCombinedActionMethods();