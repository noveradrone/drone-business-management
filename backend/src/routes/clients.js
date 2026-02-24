const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM clients ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/", authRequired, (req, res) => {
  const {
    company_name,
    contact_name,
    email,
    phone,
    billing_address,
    siret,
    vat_number,
    notes,
    source_channel,
    is_prospect
  } = req.body;
  if (!company_name) return res.status(400).json({ message: "company_name is required" });

  const result = db
    .prepare(
      `INSERT INTO clients (
        company_name, contact_name, email, phone, billing_address, siret, vat_number, notes,
        source_channel, is_prospect
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      company_name,
      contact_name || null,
      email || null,
      phone || null,
      billing_address || null,
      siret || null,
      vat_number || null,
      notes || null,
      source_channel || null,
      Number(is_prospect ? 1 : 0)
    );

  res.status(201).json(db.prepare("SELECT * FROM clients WHERE id = ?").get(result.lastInsertRowid));
});

router.put("/:id", authRequired, (req, res) => {
  const {
    company_name,
    contact_name,
    email,
    phone,
    billing_address,
    siret,
    vat_number,
    notes,
    source_channel,
    is_prospect
  } = req.body;
  const result = db
    .prepare(
      `UPDATE clients
       SET company_name = COALESCE(?, company_name),
           contact_name = COALESCE(?, contact_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           billing_address = COALESCE(?, billing_address),
           siret = COALESCE(?, siret),
           vat_number = COALESCE(?, vat_number),
           notes = COALESCE(?, notes),
           source_channel = COALESCE(?, source_channel),
           is_prospect = COALESCE(?, is_prospect)
       WHERE id = ?`
    )
    .run(
      company_name,
      contact_name,
      email,
      phone,
      billing_address,
      siret,
      vat_number,
      notes,
      source_channel,
      is_prospect === undefined ? undefined : Number(is_prospect ? 1 : 0),
      req.params.id
    );

  if (!result.changes) return res.status(404).json({ message: "Client not found" });
  res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
});

router.delete("/:id", authRequired, (req, res) => {
  try {
    const result = db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ message: "Client not found" });
    return res.status(204).send();
  } catch (error) {
    return res.status(409).json({ message: "Client cannot be deleted because it is still referenced" });
  }
});

module.exports = router;
