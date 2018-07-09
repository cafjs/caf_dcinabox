Creates a generic image named `gcr.io/cafjs-k8/root-generic`

Its purpose is to avoid `dcinabox` building a container image when we just want to use a local directory build. For example:

      dcinabox.js --appLocalName helloworld --appImage gcr.io/cafjs-k8/root-generic --appWorkingDir $PWD --hostVolume $HOME --appVolume $HOME

where  `$PWD` is where we have build the `helloworld` application. When we use `nvm` to manage node.js versions, all the dependencies that use npm  links are under  `$HOME`. Therefore, symbolic links do not break because we mount `$HOME` in the same path inside the container.
