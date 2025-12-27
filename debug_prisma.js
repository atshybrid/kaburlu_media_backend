const { exec } = require('child_process');
exec('npx prisma validate', { cwd: 'd:\\Kaburlu Softwares\\Kaburlu_Media_Backend\\Kaburlu_Media_Backend' }, (err, stdout, stderr) => {
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
});
