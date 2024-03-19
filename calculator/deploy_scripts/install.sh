#!/bin/bash
source /home/ec2-user/.bash_profile
cd /home/ec2-user

# Check Node Version
if [ ! -x "$(command -v node)" ]  # Check if node executable exists
then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
  . ~/.nvm/nvm.sh
  nvm install lts/*
fi
