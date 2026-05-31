const express = require("express");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const nodemailer = require("nodemailer");

const router = express.Router();

const getTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else {
    // Ethereal automatic test account for testing
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};

// Mail templates
const MAIL_TEMPLATES = [
  {
    id: "relance",
    name: "Relance Client",
    subject: "Des nouvelles de votre demande de mutuelle - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nNous avons tenté de vous joindre aujourd'hui au sujet de votre demande de comparatif de mutuelle.\n\nPourriez-vous nous indiquer vos disponibilités afin que nous puissions faire le point ensemble sur vos besoins ?\n\nCordialement,\nL'équipe SecurAssure"
  },
  {
    id: "offre_senior",
    name: "Offre Mutuelle Senior",
    subject: "Des garanties renforcées pour votre mutuelle - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nDécouvrez nos nouvelles garanties spécifiquement conçues pour les seniors : prise en charge renforcée des frais d'optique, de dentaire et des médecines douces.\n\nNous sommes à votre disposition pour vous réaliser un devis gratuit et personnalisé.\n\nCordialement,\nL'équipe SecurAssure"
  },
  {
    id: "confirm_rdv",
    name: "Confirmation de Rendez-vous",
    subject: "Confirmation de votre rendez-vous - SecurAssure",
    body: "Bonjour [Nom] [Prenom],\n\nNous vous confirmons votre rendez-vous avec un de nos conseillers SecurAssure.\n\nNous vous recontacterons au numéro fourni.\n\nCordialement,\nL'équipe SecurAssure"
  }
];

// Get templates
router.get("/templates", verifyToken, (req, res) => {
  res.json(MAIL_TEMPLATES);
});

// Send mail
router.post("/send", verifyToken, async (req, res) => {
  const { recipientEmail, recipientName, subject, body } = req.body;
  const senderId = req.user.id;

  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({ error: "Champs obligatoires manquants : destinataire, sujet et contenu" });
  }

  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || `"SecurAssure" <contact@jechangemamutuelle.online>`,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl = "";
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }

    const result = await pool.query(
      `INSERT INTO mail_logs (sender_id, recipient_email, recipient_name, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, 'SENT')
       RETURNING id, created_at`,
      [senderId, recipientEmail, recipientName, subject, body]
    );

    res.json({
      message: previewUrl ? "E-mail envoyé avec succès (simulation SMTP)" : "E-mail envoyé avec succès",
      mailId: result.rows[0].id,
      status: "SENT",
      created_at: result.rows[0].created_at,
      previewUrl,
    });
  } catch (err) {
    console.error("Error sending mail:", err);
    res.status(500).json({ error: "Erreur lors de l'envoi de l'e-mail : " + err.message });
  }
});

// Get mail history
router.get("/history", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let queryText = `
      SELECT mail_logs.*, users.name AS sender_name 
      FROM mail_logs 
      LEFT JOIN users ON users.id = mail_logs.sender_id
    `;
    const params = [];

    // Admins and Super Admins can see all emails, agents only their own
    if (userRole === "AGENT") {
      queryText += " WHERE mail_logs.sender_id = $1";
      params.push(userId);
    } else if (userRole === "ADMIN") {
      // Filter by center users if admin
      queryText += " WHERE users.center_id = $1 OR mail_logs.sender_id = $2";
      params.push(req.user.center_id, userId);
    }

    queryText += " ORDER BY mail_logs.created_at DESC";

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching mail history:", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

module.exports = router;
