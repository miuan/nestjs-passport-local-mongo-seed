import {Test} from '@nestjs/testing';
import { UsersService } from './users.service';
import * as mongoose from 'mongoose';
import {Users} from './models/Users';
import {expect} from 'chai';

describe('UserService', () => {
    

    let usersService : UsersService;

    before((done)=>{
        
        mongoose.connect('mongodb://localhost/g4t-test', {useMongoClient: true}, (error)=> {
            Users.remove({}, ()=> {

                var newUser            = new Users();

                // set the user's local credentials
                newUser.local.email    = 'ahoj1@seznam.cz';
                newUser.local.password = newUser.generateHash('b123456');
                newUser.save(() => done());
                
            });
        });
        
    });

    after((done)=>{
        Users.remove({}, ()=> {
            mongoose.connection.close();
            done();
        });
    })

    beforeEach(() => {
        Test.createTestingModule({
            components: [
              UsersService
            ]
          })

        usersService = Test.get(UsersService);
    });

    it('all users not contain password', async ()=>{
        let users = await usersService.getAllUsers();
        expect(users).to.be.an('array');
        expect(users).to.have.lengthOf(1);
        expect(users).to.not.have.property('password');
        console.log(users);
    })

    it('find one user by email `ahoj1@seznam.cz`', (done)=>{
        
        usersService.getUserByEmail('ahoj1@seznam.cz', (err, user)=>{
            expect(user).to.be.an('object');
            expect(user).to.have.property('local');
            expect(user.local).to.have.property('email');
            expect(user.local.email).to.be.equal('ahoj1@seznam.cz');
            
            done();
        });
        
    })


    it('valid password `ahoj1@seznam.cz`', (done)=>{
       
        usersService.getUserByEmail('ahoj1@seznam.cz', (err, user)=>{
            expect(user).to.be.an('object');
            expect(user).to.have.property('local');
            expect(user.local).to.have.property('email');
            expect(user.local.email).to.be.equal('ahoj1@seznam.cz');

            user.validPassword('b123456', (error, valid)=>{
                expect(valid).to.be.true;
                done();
            });
            
        });
        
    })

    it('invalid password `ahoj1@seznam.cz`', (done)=>{
        usersService.getUserByEmail('ahoj1@seznam.cz', (err, user)=>{
            expect(user).to.be.an('object');
            expect(user).to.have.property('local');
            expect(user.local).to.have.property('email');
            expect(user.local.email).to.be.equal('ahoj1@seznam.cz');

            user.validPassword('blablabla', (error, valid)=>{
                expect(valid).to.be.false;
                done();
            });
            
        });
    })

    it('login user `ahoj1@seznam.cz` and retrieve token, refreshToken', (done) => {
        usersService.login('ahoj1@seznam.cz', 'b123456', (err, user) => {
            expect(user).to.be.a('object');
            expect(user).to.have.property('user');
            expect(user).to.have.property('token');
            expect(user).to.have.property('refreshToken');
            
            done();
        });
    }) 
    

    it('login user `ahoj1@seznam.cz` and check the retrieved tokens', (done) => {
        usersService.login('ahoj1@seznam.cz', 'b123456', (err, loginInfo) => {
            
                
            //console.log('tokenValid',loginInfo, decoded);

            expect(err).to.be.null;
            expect(loginInfo).to.be.a('object');
            expect(loginInfo).to.have.property('user');
            expect(loginInfo).to.have.property('token');
            
            let verifyErrorEx = null;
            let decoded = null;

            try {
                decoded = usersService.tokenVerify(loginInfo.token);
            } catch(verifyError) {
                verifyErrorEx = verifyError;
            }

            expect(verifyErrorEx).to.be.null;
            expect(decoded).to.have.property('email');
            expect(decoded).to.have.property('id');
            
            done();
        });
    }) 

    // it('login user `ahoj1@seznam.cz` and check the retrieved tokens', (done) => {
    //     usersService.login('ahoj1@seznam.cz', 'b123456', (err, user) => {
    //         usersService.tokenVerify(user.token, (err, decoded)=>{
                
    //             console.log('tokenValid', err, decoded);

    //             expect(err).to.be.null;
    //             expect(decoded).to.be.a('object');
    //             expect(decoded).to.have.property('user');
                
    //             done();
    //         })
    //     });
    // })  

    it('login user `ahoj1@seznam.cz` and refresh the retrieved tokens', (done) => {
        
        //
        // create token what will expire after one 1ms
        //
        usersService.login('ahoj1@seznam.cz', 'b123456', {jwt:{expiresIn:'1ms'}}, (err, loginInfo) => {
            
            expect(loginInfo).to.have.property('refreshToken');
            expect(loginInfo).to.have.property('token');

            // 
            // wait two milliseconds
            //
            setTimeout(()=>{

                let expired = null;
                let decoded = false;

                try {
                    decoded = usersService.tokenVerify(loginInfo.token);
                } catch (err) {
                    expired = err;
                }
                
                //
                // we should get tokenExpiredError
                //
                expect(expired).is.an('object');
                expect(expired).have.a.property('name');
                expect(expired.name).is.equal('TokenExpiredError');

                usersService.tokenRefresh(loginInfo.token, loginInfo.refreshToken, (err, newTokens)=>{
                    //console.log('newTokens', newTokens);
                    expect(err).to.be.null;

                    //
                    // old token and new tokens, can't be the same
                    //
                    expect(loginInfo.token).not.to.be.equal(newTokens.token);
                    expect(loginInfo.refreshToken).not.to.be.equal(newTokens.refreshToken);

                    //
                    // test new tokens could be verified as OK
                    //
                    try {
                        expired = null;
                        decoded = null;
                        decoded = usersService.tokenVerify(newTokens.token);
                    } catch (err) {
                        expired = err;
                    }

                    //console.log('new decoded', decoded);
                    expect(expired).is.null;
                    expect(decoded).not.to.be.null;
                    expect(decoded).is.a('object');
                    expect(decoded).have.a.property('email');
                    expect(decoded).have.a.property('id');


                    
                    usersService.tokenRefresh(newTokens.token, newTokens.refreshToken, (err, newNewTokens)=>{
                        
                        //console.log('newNewTokens', err, newNewTokens);
                        expect(newNewTokens).not.to.be.null;

                        //
                        // we should get error, because old token is not used anymore
                        //
                        usersService.tokenRefresh(loginInfo.token, loginInfo.refreshToken, (err, newNewTokens2)=>{
                            
                            expect(err).not.to.be.null;
                            expect(newNewTokens2).to.be.undefined;
                            //console.log('newNewTokens @2', err, newNewTokens2);

                            done();
                        });
                    });
                })


            }, 2);


            
            
        });
    }) 

});