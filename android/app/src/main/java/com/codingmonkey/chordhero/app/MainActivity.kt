package com.codingmonkey.chordhero.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.codingmonkey.chordhero.designsystem.ChordHeroTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as ChordHeroApplication).container
        setContent {
            ChordHeroTheme {
                ChordHeroRoot(container)
            }
        }
    }

    override fun onStop() {
        super.onStop()
        (application as ChordHeroApplication).container.audio.stop()
    }
}
