#!/bin/sh

CURDIR=$(dirname $0)
if [ "$CURDIR" = '.' ]
then
    CURDIR=`pwd`
fi
cd $CURDIR
if [ "$2" = 'bundle' ]
then
    cd ../web && /usr/bin/php index.php $1 /modules/{module-name}/bundle.json
else
    cd ../web && /usr/bin/php index.php $1 /bundle.json
fi