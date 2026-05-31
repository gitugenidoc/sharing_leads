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
    "id": "relance_contact",
    "name": "Relance contact",
    "subject": "Des nouvelles de votre demande de mutuelle - SecurAssure",
    "body": "Bonjour [Civilite] [Nom],\n\nNous avons tente de vous joindre au sujet de votre demande de comparatif mutuelle.\n\nPouvez-vous nous indiquer vos disponibilites afin que nous puissions faire le point sur vos besoins et votre tarif actuel ([PrixMutuelle]) ?\n\nCordialement,\nL'equipe SecurAssure"
  },
  {
    "id": "proposition_devis",
    "name": "Proposition devis",
    "subject": "Votre devis mutuelle personnalise - SecurAssure",
    "body": "Bonjour [Civilite] [Nom],\n\nD'apres les informations de votre fiche, votre mutuelle actuelle est [Mutuelle] pour un tarif de [PrixMutuelle].\n\nNous pouvons vous proposer une comparaison personnalisee avec des garanties adaptees a vos besoins : [Besoins].\n\nUn conseiller peut vous rappeler rapidement pour finaliser le devis.\n\nCordialement,\nL'equipe SecurAssure"
  },
  {
    "id": "confirmation_rdv",
    "name": "Confirmation rendez-vous",
    "subject": "Confirmation de votre rendez-vous - SecurAssure",
    "body": "Bonjour [Civilite] [Nom],\n\nNous vous confirmons votre rendez-vous avec un conseiller SecurAssure.\n\nNous vous recontacterons au numero indique dans votre fiche afin de valider les garanties et le budget mutuelle.\n\nCordialement,\nL'equipe SecurAssure"
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
