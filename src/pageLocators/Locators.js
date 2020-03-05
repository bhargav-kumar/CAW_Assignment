class locators {
    constructor() {

        //GrowthZone
        this.userNameTxt = "Username";
        this.password = "Password",
        this.loginBtn = "sign-up-button"

        //BigBasket
        this.beatyANdHygiene = "(.//h2[@class='section-title ng-binding'][text()='Beauty & Hygiene']/parent::div//following-sibling::section//div//a[@class='ng-scope'])[1]/img";
        this.lakme = "(//a[contains(@ng-href,'lakme')])[1]";
        this.addToBasket = "//span[text()='ADD TO BASKET']";
        this.ItemsInBasket = "//div[@class='eubx4']";
        this.category = "//a[@qa='categoryDD']";
        this.vegetables = "//li//a[text()='Fruits & Vegetables'][@qa='catL1']";
    }
}

module.exports = new locators();