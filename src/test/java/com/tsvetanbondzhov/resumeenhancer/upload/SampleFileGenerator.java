package com.tsvetanbondzhov.resumeenhancer.upload;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Utility to generate minimal but realistic resume PDF and DOCX bytes for tests.
 * Both formats contain recognizable section headings: Experience, Education, Skills.
 */
public class SampleFileGenerator {

    public static byte[] generatePdfResume(String name) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
                PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

                cs.setFont(bold, 16);
                cs.beginText();
                cs.newLineAtOffset(50, 750);
                cs.showText(name);
                cs.endText();

                cs.setFont(bold, 13);
                cs.beginText();
                cs.newLineAtOffset(50, 710);
                cs.showText("Work Experience");
                cs.endText();

                cs.setFont(font, 11);
                cs.beginText();
                cs.newLineAtOffset(50, 690);
                cs.showText("Software Engineer at Acme Corp (2022-2024)");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(50, 675);
                cs.showText("Developed backend services using Java and Spring Boot.");
                cs.endText();

                cs.setFont(bold, 13);
                cs.beginText();
                cs.newLineAtOffset(50, 645);
                cs.showText("Education");
                cs.endText();

                cs.setFont(font, 11);
                cs.beginText();
                cs.newLineAtOffset(50, 625);
                cs.showText("BSc Computer Science - State University (2018-2022)");
                cs.endText();

                cs.setFont(bold, 13);
                cs.beginText();
                cs.newLineAtOffset(50, 595);
                cs.showText("Skills");
                cs.endText();

                cs.setFont(font, 11);
                cs.beginText();
                cs.newLineAtOffset(50, 575);
                cs.showText("Java, Spring Boot, PostgreSQL, Docker, REST APIs");
                cs.endText();
            }

            doc.save(out);
            return out.toByteArray();
        }
    }

    public static byte[] generateDocxResume(String name) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            addParagraph(doc, name);
            addParagraph(doc, "");
            addParagraph(doc, "Work Experience");
            addParagraph(doc, "Software Engineer at Acme Corp (2022-2024)");
            addParagraph(doc, "Developed backend services using Java and Spring Boot.");
            addParagraph(doc, "");
            addParagraph(doc, "Education");
            addParagraph(doc, "BSc Computer Science - State University (2018-2022)");
            addParagraph(doc, "");
            addParagraph(doc, "Skills");
            addParagraph(doc, "Java, Spring Boot, PostgreSQL, Docker, REST APIs");

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static void addParagraph(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        XWPFRun run = para.createRun();
        run.setText(text);
    }
}
