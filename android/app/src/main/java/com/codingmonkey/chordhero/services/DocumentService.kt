package com.codingmonkey.chordhero.services

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import androidx.core.content.FileProvider
import com.codingmonkey.chordhero.domain.ChordLibraryItem
import java.io.File
import java.io.OutputStream

interface DocumentService {
    fun writeChordSheet(title: String, chords: List<ChordLibraryItem>, output: OutputStream)
    fun createShareIntent(title: String, chords: List<ChordLibraryItem>): Intent
    fun print(title: String, chords: List<ChordLibraryItem>)
}

class AndroidDocumentService(private val context: Context) : DocumentService {
    override fun writeChordSheet(title: String, chords: List<ChordLibraryItem>, output: OutputStream) {
        val document = PdfDocument()
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
        val page = document.startPage(PdfDocument.PageInfo.Builder(612, 792, 1).create())
        page.canvas.drawColor(Color.WHITE)
        paint.textSize = 24f
        paint.isFakeBoldText = true
        page.canvas.drawText(title, 36f, 48f, paint)
        paint.isFakeBoldText = false
        chords.take(9).forEachIndexed { index, item ->
            val column = index % 3
            val row = index / 3
            val left = 36f + column * 188f
            val top = 92f + row * 220f
            drawChord(page.canvas, item, left, top, paint)
        }
        document.finishPage(page)
        document.writeTo(output)
        document.close()
    }

    private fun drawChord(
        canvas: android.graphics.Canvas,
        item: ChordLibraryItem,
        left: Float,
        top: Float,
        paint: Paint,
    ) {
        paint.textSize = 18f
        paint.isFakeBoldText = true
        canvas.drawText(item.chord.name, left, top, paint)
        paint.isFakeBoldText = false
        val gridTop = top + 24f
        val width = 120f
        val height = 120f
        paint.strokeWidth = 2f
        repeat(6) { string ->
            val x = left + string * width / 5
            canvas.drawLine(x, gridTop, x, gridTop + height, paint)
        }
        repeat(6) { fret ->
            val y = gridTop + fret * height / 5
            canvas.drawLine(left, y, left + width, y, paint)
        }
        val base = com.codingmonkey.chordhero.domain.PracticeRules.baseFret(item.chord)
        item.chord.frets.forEachIndexed { string, fret ->
            val x = left + string * width / 5
            when {
                fret < 0 -> canvas.drawText("×", x - 5, gridTop - 7, paint)
                fret == 0 -> canvas.drawCircle(x, gridTop - 10, 4f, paint)
                else -> {
                    val row = (fret - base).coerceIn(0, 4)
                    canvas.drawCircle(x, gridTop + (row + .5f) * height / 5, 6f, paint)
                }
            }
        }
        paint.textSize = 10f
        canvas.drawText(item.practiceFocus.take(28), left, gridTop + height + 20f, paint)
    }

    override fun createShareIntent(title: String, chords: List<ChordLibraryItem>): Intent {
        val directory = File(context.cacheDir, "shared").apply { mkdirs() }
        val file = File(directory, "chord-hero-${title.lowercase().replace(Regex("[^a-z0-9]+"), "-")}.pdf")
        file.outputStream().use { writeChordSheet(title, chords, it) }
        val uri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        return Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    override fun print(title: String, chords: List<ChordLibraryItem>) {
        val manager = context.getSystemService(PrintManager::class.java)
        manager.print(
            title,
            object : PrintDocumentAdapter() {
                override fun onLayout(
                    oldAttributes: PrintAttributes?,
                    newAttributes: PrintAttributes,
                    cancellationSignal: CancellationSignal,
                    callback: LayoutResultCallback,
                    extras: android.os.Bundle?,
                ) {
                    if (cancellationSignal.isCanceled) {
                        callback.onLayoutCancelled()
                    } else {
                        callback.onLayoutFinished(
                            PrintDocumentInfo.Builder("$title.pdf")
                                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                .setPageCount(1)
                                .build(),
                            true,
                        )
                    }
                }

                override fun onWrite(
                    pages: Array<out PageRange>,
                    destination: ParcelFileDescriptor,
                    cancellationSignal: CancellationSignal,
                    callback: WriteResultCallback,
                ) {
                    runCatching {
                        ParcelFileDescriptor.AutoCloseOutputStream(destination).use {
                            writeChordSheet(title, chords, it)
                        }
                    }.fold(
                        onSuccess = { callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES)) },
                        onFailure = { callback.onWriteFailed(it.message) },
                    )
                }
            },
            PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.NA_LETTER.asPortrait())
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build(),
        )
    }
}
