import { env } from "../config/env";

interface EmailPayload {
    service_id: string;
    template_id: string;
    user_id: string;
    accessToken?: string;
    template_params: Record<string, string>;
}

const sendEmail = async (
    templateId: string,
    templateParams: Record<string, string>
): Promise<void> => {
    const payload: EmailPayload = {
        service_id:
            env.EMAILJS_SERVICE_ID,

        template_id:
            templateId,

        user_id:
            env.EMAILJS_PUBLIC_KEY,

        template_params:
            templateParams,
    };

    if (
        env.EMAILJS_PRIVATE_KEY
    ) {
        payload.accessToken =
            env.EMAILJS_PRIVATE_KEY;
    }

    const response =
        await fetch(
            "https://api.emailjs.com/api/v1.0/email/send",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body:
                    JSON.stringify(
                        payload
                    ),
            }
        );

    if (!response.ok) {
        const errorText =
            await response.text();

        throw new Error(
            errorText ||
            "Email could not be sent."
        );
    }
};

export const sendVerificationEmail =
    async (
        email: string,
        fullName: string,
        code: string
    ): Promise<void> => {
        await sendEmail(
            env.EMAILJS_TEMPLATE_ID,
            {
                to_email:
                    email,

                full_name:
                    fullName,

                verification_code:
                    code,
            }
        );
    };

export const sendPasswordResetEmail =
    async (
        email: string,
        fullName: string,
        code: string
    ): Promise<void> => {
        await sendEmail(
            env.EMAILJS_RESET_TEMPLATE_ID,
            {
                to_email:
                    email,

                full_name:
                    fullName,

                reset_code:
                    code,
            }
        );
    };