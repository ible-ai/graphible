# Step 1: Clean install
rm -rf node_modules package-lock.json
npm install

# Step 2: Test the build locally
npm run build

# Step 3: Test the built app locally
npm run preview

# Step 4: If successful, push to GitHub
git add .
git commit -m "Fix deployment issues"
git push