import { type Request, type Response, type NextFunction } from "express";
import { PDFParse } from "pdf-parse";
import { analyzeResume } from "../services/resumeService";

export const analyzeResumeController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user || !req.user._id) {
            res.status(401).json({
                success: false,
                message: "Not authorized",
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "Please upload a valid PDF resume file",
            });
            return;
        }

        const parser = new PDFParse({ data: req.file.buffer });
        const pdfData = await parser.getText();
        const resumeText = pdfData.text ? pdfData.text.trim() : "";

        await parser.destroy();

        if (!resumeText || resumeText.length < 20) {
            res.status(400).json({
                success: false,
                message: "Could not extract readable text from the uploaded PDF resume",
            });
            return;
        }

        const analysis = await analyzeResume({ resumeText });

        res.status(200).json({
            success: true,
            data: {
                analysis,
            },
        });
    } catch (error) {
        next(error);
    }
};