# Interactive 3D Portfolio

## Setup
1. Install Node 18+. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in your own Gemini API key (aistudio.google.com) and Gmail app password (Google Account > Security > 2-Step Verification > App passwords). `.env` is listed in `.gitignore` and must never be committed or shared.
3. Edit the `ME` object at the top of the script in `public/index.html` with your content.
4. Edit `data/about.md` (add more .md/.txt files: CV, project descriptions). The chatbot re-indexes automatically.
5. Put `avatar.glb` and `intro.mp4` in `public/assets/`.
6. `npm start` then open http://localhost:3000

## RAG pipeline
Documents in `data/` are split into ~600 character overlapping chunks, embedded with Gemini's gemini-embedding-001, and stored in an in-memory vector index (cached as `index.json`). Each question is embedded, the 4 most similar chunks (cosine similarity) are retrieved and passed to the LLM with a strict "answer only from context" prompt, so it admits when it does not know.

## Deploy
Push to GitHub, then create a Web Service on Render: build `npm install`, start `npm start`, and add `GEMINI_API_KEY`, `RESEND_API_KEY` and `CONTACT_TO` as environment variables in the dashboard (never upload `.env`). Free hosts block Gmail's email ports, so online the contact form sends through Resend's HTTPS API (free key from resend.com).

## Making the avatar in Blender (summary)
1. Delete the default cube. Add a UV Sphere (head), scale it. Add a Cylinder/Capsule for the body, Cylinders for arms and legs. Name the head object exactly `Head` (the site rotates it toward the mouse).
2. Tab into Edit Mode: use Proportional Editing (O) and Extrude (E) to shape the jaw, nose, hair; add Subdivision Surface modifier for smoothness.
3. Materials: Material tab > New > set Base Color per part (skin, shirt, hair). For a face/shirt logo, UV unwrap (U) and add an Image Texture.
4. Rig: Shift+A > Armature. In Edit Mode extrude bones for spine, head, arms, legs. Select meshes, then the armature, Ctrl+P > With Automatic Weights.
5. Animate: Pose Mode, set a rest pose at frame 1, rotate the arm for a wave at frame 20, back at frame 40, press I to key each. Open the Nonlinear Animation editor and push down as one action named `Idle`, loop it.
6. Export: File > Export > glTF 2.0 (.glb), tick Include > Selected Objects, Animation, and Apply Modifiers. Save as `public/assets/avatar.glb`. Keep the .blend file for submission.
7. Test at https://gltf-viewer.donmccurdy.com before adding it to the site.
