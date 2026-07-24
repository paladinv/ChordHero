import XCTest

final class ChordHeroUITests: XCTestCase {
    @MainActor
    func testPrimaryNavigation() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Practice"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Trainer"].exists)
        app.tabBars.buttons["Song Library"].tap()
        XCTAssertTrue(app.navigationBars["Song Library"].waitForExistence(timeout: 3))
        app.tabBars.buttons["Library"].tap()
        XCTAssertTrue(app.staticTexts["ChordLibraryScreen"].waitForExistence(timeout: 3))
        app.tabBars.buttons["Chart"].tap()
        XCTAssertTrue(app.navigationBars["Chord Chart"].waitForExistence(timeout: 3))
        app.tabBars.buttons["Tools"].tap()
        XCTAssertTrue(app.navigationBars["Tools"].waitForExistence(timeout: 3))
    }
}
