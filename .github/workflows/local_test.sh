# Step 1: Clean install
rm -rf node_modules package-lock.json
npm install

# Step 2: Test the build locally
npm run build

# Step 3: If successful, add to current commit
git add .