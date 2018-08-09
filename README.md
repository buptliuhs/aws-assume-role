# aws-role

## Install
```
npm install -g aws-role`
```

## View Help
```
aws-role --help
```

## Add Role Configuration
```
aws-role add --alias sandbox --role
"arn:aws:iam::123456781234:role/AdminRole" --mfa "arn:aws:iam::123456784321:mfa/buptliuhs@gmail.com" --duration 43200
```

## List Role Configuration
```
aws-role list
```

## Delete Role Configuration
```
aws-role delete --alias sandbox
```

## Assume Role
```
aws-role assume --alias sandbox --code 123456
```

