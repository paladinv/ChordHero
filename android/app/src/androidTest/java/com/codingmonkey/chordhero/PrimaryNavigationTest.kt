package com.codingmonkey.chordhero

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.codingmonkey.chordhero.app.MainActivity
import org.junit.Rule
import org.junit.Test

class PrimaryNavigationTest {
    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun launchAndOpenPrimaryDestinations() {
        rule.onNodeWithText("Chord Hero").assertIsDisplayed()
        rule.onNodeWithTag("nav_Trainer").performClick()
        rule.onNodeWithText("Timed Chord Trainer").assertIsDisplayed()
        rule.onNodeWithTag("nav_RightHand").performClick()
        rule.onNodeWithText("Right-Hand Studio").assertIsDisplayed()
        rule.onNodeWithTag("nav_Songs").performClick()
        rule.onNodeWithText("Song Coach").assertIsDisplayed()
        rule.onNodeWithTag("nav_SongLibrary").performClick()
        rule.onNodeWithText("Song Library").assertIsDisplayed()
        rule.onNodeWithTag("nav_Library").performClick()
        rule.onNodeWithText("Chord Library").assertIsDisplayed()
    }
}
