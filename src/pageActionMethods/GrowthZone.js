let safeActions = require("../Utilities/SafeActions.js");
let pageLocators = require("../pageLocators/Locators.js");

class GrowthZoneActionMethods {
    constructor() {
    }

    launchApplication(url_) {
        safeActions.appUrl(url_);
        return this;
    }

    setUserName(userName_) {
        safeActions.setUserName(by.id(pageLocators.userNameTxt), userName_);
        return this;
    }

    setPassword(password_) {
        safeActions.setUserName(by.id(pageLocators.password), password_);
        return this;
    }

    clickOnGrowthZoneLoginButton() {
        safeActions.safeClick(by.id(pageLocators.loginBtn));
        return this;
    }

}

module.exports = new GrowthZoneActionMethods();