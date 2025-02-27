$envContent = @"
ATLAS_DB_PASSWORD=${{ secrets.ATLAS_DB_PASSWORD }}
ATLAS_DB_USERNAME=${{ secrets.ATLAS_DB_USERNAME }}
ATLAS_CLUSTER=${{ secrets.ATLAS_CLUSTER }}
ATLAS_DB=${{ secrets.ATLAS_DB }}
ACCESS_TOKEN_SECRET=${{ secrets.ACCESS_TOKEN_SECRET }}
REFRESH_TOKEN_SECRET=${{ secrets.REFRESH_TOKEN_SECRET }}
SSL_CERT=${{ secrets.SSL_CERT }}
SSL_PRIVATE_KEY=${{ secrets.SSL_PRIVATE_KEY }}
SSL_CERT_INTERMEDIATE=${{ secrets.SSL_CERT_INTERMEDIATE }}
"@
$envContent | Out-File -FilePath ".env"
